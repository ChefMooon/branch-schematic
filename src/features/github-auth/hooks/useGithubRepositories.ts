import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { GitHubAppInstallation, GitHubRepository, GitHubRepositoryPage } from '../types';

interface UseGithubRepositoriesOptions {
	profileId?: string | null;
	apiBaseUrl?: string | null;
	enabled?: boolean;
	pageSize?: number;
}

interface GithubRepositoryCacheEntry {
	cacheKey: string;
	installations: GitHubAppInstallation[];
	selectedInstallationId: number;
	repositories: GitHubRepository[];
	page: number;
	hasMore: boolean;
	fetchedAt: number;
}

export interface UseGithubRepositoriesResult {
	installations: GitHubAppInstallation[];
	selectedInstallationId: number | null;
	selectedInstallation: GitHubAppInstallation | null;
	repositories: GitHubRepository[];
	lastUpdatedAt: number | null;
	isUsingCache: boolean;
	page: number;
	hasMore: boolean;
	hasLoadedOnce: boolean;
	isLoading: boolean;
	isRefreshing: boolean;
	isLoadingMore: boolean;
	error: string | null;
	reload: () => Promise<void>;
	loadMore: () => Promise<void>;
}

const REPOSITORY_CACHE_TTL_MS = 5 * 60 * 1000;

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}

	if (typeof error === 'string' && error.trim()) {
		return error.trim();
	}

	return fallbackMessage;
}

function dedupeRepositories(repositories: GitHubRepository[]): GitHubRepository[] {
	return Array.from(new Map(repositories.map((repository) => [repository.id, repository])).values());
}

export function useGithubRepositories({
	profileId,
	apiBaseUrl,
	enabled = true,
	pageSize = 30,
}: UseGithubRepositoriesOptions): UseGithubRepositoriesResult {
	const [installations, setInstallations] = useState<GitHubAppInstallation[]>([]);
	const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null);
	const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
	const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
	const [isUsingCache, setIsUsingCache] = useState(false);
	const [page, setPage] = useState(0);
	const [hasMore, setHasMore] = useState(true);
	const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestKeyRef = useRef(0);
	const hasLoadedOnceRef = useRef(false);
	const cacheRef = useRef<GithubRepositoryCacheEntry | null>(null);

	const normalizedProfileId = profileId?.trim() ?? '';
	const normalizedApiBaseUrl = apiBaseUrl?.trim() ?? '';
	const isEnabled = enabled && Boolean(normalizedProfileId);
	const cacheKey = `${normalizedApiBaseUrl}|${pageSize}|${normalizedProfileId}`;

	const resetState = useCallback(() => {
		requestKeyRef.current += 1;
		hasLoadedOnceRef.current = false;
		setInstallations([]);
		setSelectedInstallationId(null);
		setRepositories([]);
		setLastUpdatedAt(null);
		setIsUsingCache(false);
		setPage(0);
		setHasMore(true);
		setHasLoadedOnce(false);
		setIsLoading(false);
		setIsRefreshing(false);
		setIsLoadingMore(false);
		setError(null);
	}, []);

	const loadInitialPage = useCallback(async (forceRefresh = false) => {
		if (!isEnabled) {
			resetState();
			return;
		}

		const cachedValue = cacheRef.current;
		const cacheAgeMs = cachedValue ? Date.now() - cachedValue.fetchedAt : Number.POSITIVE_INFINITY;
		const canUseCache =
			!forceRefresh &&
			cachedValue?.cacheKey === cacheKey &&
			cacheAgeMs <= REPOSITORY_CACHE_TTL_MS;

		if (canUseCache && cachedValue) {
			setInstallations(cachedValue.installations);
			setSelectedInstallationId(cachedValue.selectedInstallationId);
			setRepositories(cachedValue.repositories);
			setPage(cachedValue.page);
			setHasMore(cachedValue.hasMore);
			setLastUpdatedAt(cachedValue.fetchedAt);
			setIsUsingCache(true);
			hasLoadedOnceRef.current = true;
			setHasLoadedOnce(true);
			setError(null);
			setIsLoading(false);
			setIsRefreshing(false);
			setIsLoadingMore(false);
			return;
		}

		const requestKey = ++requestKeyRef.current;
		setIsLoading(true);
		setIsRefreshing(hasLoadedOnceRef.current);
		setIsUsingCache(false);
		setError(null);

		try {
			const nextPage = await invoke<GitHubRepositoryPage>('list_remote_repositories', {
				profileId: normalizedProfileId,
				page: 1,
				perPage: pageSize,
			});
			if (requestKeyRef.current !== requestKey) {
				return;
			}

			const now = Date.now();
			const mergedRepositories = dedupeRepositories(nextPage.items);
			cacheRef.current = {
				cacheKey,
				installations: [],
				selectedInstallationId: 0,
				repositories: mergedRepositories,
				page: nextPage.page,
				hasMore: nextPage.has_more,
				fetchedAt: now,
			};

			setInstallations([]);
			setSelectedInstallationId(null);
			setRepositories(mergedRepositories);
			setLastUpdatedAt(now);
			setIsUsingCache(false);
			setPage(nextPage.page);
			setHasMore(nextPage.has_more);
			hasLoadedOnceRef.current = true;
			setHasLoadedOnce(true);
			setError(null);
		} catch (caughtError) {
			if (requestKeyRef.current !== requestKey) {
				return;
			}

			setInstallations([]);
			setSelectedInstallationId(null);
			setRepositories([]);
			setLastUpdatedAt(null);
			setIsUsingCache(false);
			setPage(0);
			setHasMore(false);
			hasLoadedOnceRef.current = true;
			setHasLoadedOnce(true);
			setError(extractErrorMessage(caughtError, 'Unable to load GitHub repositories.'));
		} finally {
			if (requestKeyRef.current === requestKey) {
				setIsLoading(false);
				setIsRefreshing(false);
			}
		}
	}, [cacheKey, isEnabled, normalizedProfileId, pageSize, resetState]);

	const loadMore = useCallback(async () => {
		if (!isEnabled || isLoading || isRefreshing || isLoadingMore || !hasMore) {
			return;
		}

		const requestKey = ++requestKeyRef.current;
		setIsLoadingMore(true);

		try {
			const nextPage = await invoke<GitHubRepositoryPage>('list_remote_repositories', {
				profileId: normalizedProfileId,
				page: page + 1,
				perPage: pageSize,
			});

			if (requestKeyRef.current !== requestKey) {
				return;
			}

			const now = Date.now();
			const mergedRepositories = dedupeRepositories([...repositories, ...nextPage.items]);
			if (cacheRef.current?.cacheKey === cacheKey) {
				cacheRef.current = {
					...cacheRef.current,
					repositories: mergedRepositories,
					page: nextPage.page,
					hasMore: nextPage.has_more,
					fetchedAt: now,
				};
			}

			setRepositories((current) => {
				const merged = [...current, ...nextPage.items];
				return dedupeRepositories(merged);
			});
			setLastUpdatedAt(now);
			setIsUsingCache(false);
			setPage(nextPage.page);
			setHasMore(nextPage.has_more);
		} catch (caughtError) {
			if (requestKeyRef.current !== requestKey) {
				return;
			}

			setError(extractErrorMessage(caughtError, 'Unable to load more GitHub repositories.'));
			setHasMore(false);
		} finally {
			if (requestKeyRef.current === requestKey) {
				setIsLoadingMore(false);
			}
		}
	}, [cacheKey, hasMore, isEnabled, isLoading, isLoadingMore, isRefreshing, normalizedProfileId, page, pageSize, repositories, selectedInstallationId]);

	useEffect(() => {
		if (!isEnabled) {
			resetState();
			return;
		}

		void loadInitialPage(false);
	}, [isEnabled, loadInitialPage, resetState]);

	const selectedInstallation = useMemo(
		() => installations.find((installation) => installation.id === selectedInstallationId) ?? null,
		[installations, selectedInstallationId]
	);

	return {
		installations,
		selectedInstallationId,
		selectedInstallation,
		repositories,
		lastUpdatedAt,
		isUsingCache,
		page,
		hasMore,
		hasLoadedOnce,
		isLoading,
		isRefreshing,
		isLoadingMore,
		error,
		reload: () => loadInitialPage(true),
		loadMore,
	};
}
