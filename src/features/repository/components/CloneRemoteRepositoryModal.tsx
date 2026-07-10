import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ArrowsClockwise, BookOpen, FolderOpen, Info, Lock } from '@phosphor-icons/react';
import { RepositoryModalShell } from './RepositoryModalShell';
import './CloneRemoteRepositoryModal.css';
import { SearchBar } from '../../../components/search-bar/SearchBar';
import { useGithubRepositories } from '../../github-auth/hooks/useGithubRepositories';
import { useNotifications } from '../../../components/notifications/NotificationProvider';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useProfileContext } from '../../auth-profile/hooks/useProfileContext';
import type {
	CloneRemoteRepositoryResult,
	RemoteBranch,
	RemoteBranchPage,
	RemoteRepository,
	RemoteRepositoryPage,
} from '../types';

type CloneTab = 'basic' | 'enterprise' | 'url';
type RepositoryTab = 'basic' | 'enterprise';

interface CloneRemoteRepositoryModalProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenProfileManagement: () => void;
}

interface RepositoryListState {
	items: RemoteRepository[];
	lastUpdatedAt: number | null;
	hasLoadedOnce: boolean;
	page: number;
	hasMore: boolean;
	isLoading: boolean;
	isRefreshing: boolean;
	error: string | null;
	search: string;
	selectedRepoId: string | null;
	selectedBranch: string;
	branchOptions: RemoteBranch[];
	isBranchLoading: boolean;
	branchError: string | null;
	destinationPath: string;
	cloneError: string | null;
}

function createInitialListState(): RepositoryListState {
	return {
		items: [],
		lastUpdatedAt: null,
		hasLoadedOnce: false,
		page: 0,
		hasMore: true,
		isLoading: false,
		isRefreshing: false,
		error: null,
		search: '',
		selectedRepoId: null,
		selectedBranch: 'main',
		branchOptions: [],
		isBranchLoading: false,
		branchError: null,
		destinationPath: '',
		cloneError: null,
	};
}

function isValidRemoteUrl(value: string): boolean {
	const trimmed = value.trim();
	return /^https?:\/\//i.test(trimmed) || /^git@/i.test(trimmed);
}

function describeRepositoryLoadError(rawMessage: string): string {
	const trimmed = rawMessage.trim();
	if (!trimmed) {
		return 'We couldn’t load repositories for cloning. Please try again.';
	}

	if (trimmed.includes("missing the 'repo' scope") || trimmed.includes('missing the repo scope')) {
		return 'The connected OAuth token is missing the repo scope required to list private repositories. Reconnect the profile and grant repository access.';
	}

	if (trimmed.includes('OAuth token')) {
		return 'We couldn’t load repositories because the selected profile is not fully authorized. Reconnect the profile and try again.';
	}

	if (trimmed.includes('full OAuth profile')) {
		return 'We couldn’t load repositories because the selected profile is not a full OAuth profile. Update the profile and try again.';
	}

	if (trimmed.includes('No active profile')) {
		return 'We couldn’t load repositories because no active profile is available. Choose or reconnect a profile and try again.';
	}

	if (trimmed.includes('Remote repository request failed') || trimmed.includes('Failed to request remote repositories')) {
		return 'We couldn’t load repositories from GitHub right now. Check your connection and try again.';
	}

	return trimmed;
}

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
	if (error instanceof Error) {
		const message = error.message.trim();
		if (message) {
			return message;
		}
	}

	if (typeof error === 'string') {
		const message = error.trim();
		if (message) {
			return message;
		}
	}

	if (error && typeof error === 'object') {
		const candidate = error as {
			message?: unknown;
			error?: unknown;
			cause?: unknown;
		};

		for (const value of [candidate.message, candidate.error, candidate.cause]) {
			if (typeof value === 'string') {
				const message = value.trim();
				if (message) {
					return message;
				}
			}
		}
	}

	return fallbackMessage;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
		return () => window.clearTimeout(timeout);
	}, [value, delayMs]);

	return debouncedValue;
}

function formatLastUpdated(value: number | null): string {
	if (!value) {
		return 'Never';
	}

	const date = new Date(value);
	const absolute = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	const elapsedMs = Math.max(0, Date.now() - value);
	const elapsedSeconds = Math.floor(elapsedMs / 1000);

	if (elapsedSeconds < 60) {
		return `${absolute} (${elapsedSeconds}s ago)`;
	}

	const elapsedMinutes = Math.floor(elapsedSeconds / 60);
	if (elapsedMinutes < 60) {
		return `${absolute} (${elapsedMinutes}m ago)`;
	}

	const elapsedHours = Math.floor(elapsedMinutes / 60);
	return `${absolute} (${elapsedHours}h ago)`;
}

export function CloneRemoteRepositoryModal({
	isOpen,
	onClose,
	onOpenProfileManagement,
}: CloneRemoteRepositoryModalProps) {
	const [activeTab, setActiveTab] = useState<CloneTab>('basic');
	const [basicState, setBasicState] = useState<RepositoryListState>(createInitialListState);
	const [enterpriseState, setEnterpriseState] = useState<RepositoryListState>(createInitialListState);
	const [urlInput, setUrlInput] = useState('');
	const [urlBranchInput, setUrlBranchInput] = useState('main');
	const [urlDestinationPath, setUrlDestinationPath] = useState('');
	const [urlError, setUrlError] = useState<string | null>(null);
	const [urlCloneError, setUrlCloneError] = useState<string | null>(null);
	const [isCloning, setIsCloning] = useState(false);
	const [openInfoRepoId, setOpenInfoRepoId] = useState<string | null>(null);

	const basicLoadMoreRef = useRef<HTMLDivElement | null>(null);
	const enterpriseLoadMoreRef = useRef<HTMLDivElement | null>(null);
	const infoPopoverRef = useRef<HTMLDivElement | null>(null);
	const isOpenRef = useRef(isOpen);
	const listRequestKeyRef = useRef<Record<RepositoryTab, number>>({ basic: 0, enterprise: 0 });
	const branchRequestKeyRef = useRef<Record<RepositoryTab, number>>({ basic: 0, enterprise: 0 });

	const { addToast } = useNotifications();
	const { hydrateFromBackend, hydrateQuickFilterMetadata } = useWorkspaceStore();
	const { activeProfile, tokenHealthMap } = useProfileContext();

	const profileHealth = activeProfile ? tokenHealthMap[activeProfile.id] ?? 'none' : 'none';
	const canUseRemoteClone =
		Boolean(activeProfile) &&
		activeProfile?.auth_level === 'full_oauth' &&
		profileHealth === 'healthy';
	const githubRepositories = useGithubRepositories({
		accessToken: activeProfile?.token_value ?? null,
		apiBaseUrl: activeProfile?.api_base_url ?? undefined,
		enabled: isOpen && activeTab === 'basic' && canUseRemoteClone,
		pageSize: 30,
	});
	const isEnterpriseConfigured =
		canUseRemoteClone && Boolean(activeProfile?.api_base_url?.trim());

	const debouncedBasicSearch = useDebouncedValue(basicState.search, 300);
	const debouncedEnterpriseSearch = useDebouncedValue(enterpriseState.search, 300);

	const isAnyFetchInProgress =
		githubRepositories.isLoading ||
		githubRepositories.isRefreshing ||
		githubRepositories.isLoadingMore ||
		enterpriseState.isLoading ||
		enterpriseState.isRefreshing;
	const basicLastUpdatedLabel = formatLastUpdated(githubRepositories.lastUpdatedAt);
	const enterpriseLastUpdatedLabel = formatLastUpdated(enterpriseState.lastUpdatedAt);

	const activeRepositoryState = activeTab === 'enterprise' ? enterpriseState : basicState;
	const setActiveRepositoryState = activeTab === 'enterprise' ? setEnterpriseState : setBasicState;

	const fetchRepositoryPage = useCallback(
		async (tab: RepositoryTab, mode: 'append' | 'reset', options?: { force?: boolean }) => {
			if (!activeProfile?.id) {
				return;
			}

			if (tab === 'basic') {
				return;
			}

			const force = options?.force ?? false;

			const isEnterpriseTab = tab === 'enterprise';
			const state = isEnterpriseTab ? enterpriseState : basicState;
			if (state.isLoading && !force) {
				return;
			}

			if (!canUseRemoteClone) {
				return;
			}

			const nextPage = mode === 'append' ? state.page + 1 : 1;
			const command = isEnterpriseTab ? 'list_enterprise_repositories' : 'list_remote_repositories';

			const setState = isEnterpriseTab ? setEnterpriseState : setBasicState;
			const requestKey = listRequestKeyRef.current[tab] + 1;
			listRequestKeyRef.current[tab] = requestKey;

			setState((current) => ({
				...current,
				isLoading: true,
				isRefreshing: mode === 'reset',
				error: null,
			}));

			try {
				const payload = await invoke<RemoteRepositoryPage>(command, {
					profileId: activeProfile.id,
					page: nextPage,
					perPage: 30,
				});

				if (!isOpenRef.current || listRequestKeyRef.current[tab] !== requestKey) {
					return;
				}

				setState((current) => {
					const incoming = mode === 'reset' ? payload.items : [...current.items, ...payload.items];
					const deduped = Array.from(new Map(incoming.map((entry) => [entry.id, entry])).values());
					const now = Date.now();

					return {
						...current,
						items: deduped,
						lastUpdatedAt: now,
						hasLoadedOnce: true,
						page: payload.page,
						hasMore: payload.has_more,
						isLoading: false,
						isRefreshing: false,
						error: null,
						cloneError: mode === 'reset' ? null : current.cloneError,
					};
				});
			} catch (error) {
				if (!isOpenRef.current || listRequestKeyRef.current[tab] !== requestKey) {
					return;
				}

				const rawMessage = extractErrorMessage(error, 'Failed to fetch repositories.');
				const message = describeRepositoryLoadError(rawMessage);
				setState((current) => ({
					...current,
					hasLoadedOnce: true,
					hasMore: false,
					isLoading: false,
					isRefreshing: false,
					error: message,
				}));
			}
		},
		[activeProfile?.id, basicState, canUseRemoteClone, enterpriseState]
	);

	useEffect(() => {
		if (activeTab !== 'basic') {
			return;
		}

		setBasicState((current) => ({
			...current,
			items: githubRepositories.repositories,
			hasLoadedOnce: githubRepositories.hasLoadedOnce,
			page: githubRepositories.page,
			hasMore: githubRepositories.hasMore,
			isLoading: githubRepositories.isLoading,
			isRefreshing: githubRepositories.isRefreshing,
			error: githubRepositories.error,
		}));
	}, [
		activeTab,
		githubRepositories.error,
		githubRepositories.hasLoadedOnce,
		githubRepositories.hasMore,
		githubRepositories.isLoading,
		githubRepositories.isRefreshing,
		githubRepositories.page,
		githubRepositories.repositories,
	]);

	const fetchBranchesForSelection = useCallback(
		async (tab: RepositoryTab, repository: RemoteRepository) => {
			if (!activeProfile?.id) {
				return;
			}

			const requestKey = branchRequestKeyRef.current[tab] + 1;
			branchRequestKeyRef.current[tab] = requestKey;
			const setState = tab === 'enterprise' ? setEnterpriseState : setBasicState;

			setState((current) => ({
				...current,
				isBranchLoading: true,
				branchError: null,
			}));

			try {
				const payload = await invoke<RemoteBranchPage>('list_remote_branches', {
					profileId: activeProfile.id,
					owner: repository.owner.login,
					repoName: repository.name,
					page: 1,
					perPage: 100,
				});

				if (!isOpenRef.current || branchRequestKeyRef.current[tab] !== requestKey) {
					return;
				}

				setState((current) => {
					if (current.selectedRepoId !== repository.id) {
						return {
							...current,
							isBranchLoading: false,
						};
					}

					const defaultBranch = repository.default_branch?.trim() || 'main';
					const hasDefault = payload.items.some((branch) => branch.name === defaultBranch);
					return {
						...current,
						branchOptions: payload.items,
						selectedBranch: hasDefault
							? defaultBranch
							: payload.items[0]?.name ?? defaultBranch,
						isBranchLoading: false,
						branchError: null,
					};
				});
			} catch (error) {
				if (!isOpenRef.current || branchRequestKeyRef.current[tab] !== requestKey) {
					return;
				}

				const message = extractErrorMessage(error, 'Failed to fetch branches.');
				setState((current) => ({
					...current,
					isBranchLoading: false,
					branchError: message,
				}));
			}
		},
		[activeProfile?.id]
	);

	const handleSelectRepository = useCallback(
		(tab: RepositoryTab, repository: RemoteRepository) => {
			const setState = tab === 'enterprise' ? setEnterpriseState : setBasicState;
			setState((current) => ({
				...current,
				selectedRepoId: repository.id,
				selectedBranch: repository.default_branch?.trim() || 'main',
				branchOptions: [],
				branchError: null,
				cloneError: null,
			}));

			void fetchBranchesForSelection(tab, repository);
		},
		[fetchBranchesForSelection]
	);

	const filteredBasicRepositories = useMemo(() => {
		const query = debouncedBasicSearch.trim().toLowerCase();
		const filtered = !query
			? basicState.items
			: basicState.items.filter((repository) => {
				const target = `${repository.name} ${repository.full_name} ${repository.owner.login} ${repository.description ?? ''}`;
				return target.toLowerCase().includes(query);
			});

		return [...filtered].sort((left, right) =>
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
		);
	}, [basicState.items, debouncedBasicSearch]);

	const filteredEnterpriseRepositories = useMemo(() => {
		const query = debouncedEnterpriseSearch.trim().toLowerCase();
		const filtered = !query
			? enterpriseState.items
			: enterpriseState.items.filter((repository) => {
			const target = `${repository.name} ${repository.full_name} ${repository.owner.login} ${repository.description ?? ''}`;
			return target.toLowerCase().includes(query);
			});

		return [...filtered].sort((left, right) =>
			left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
		);
	}, [enterpriseState.items, debouncedEnterpriseSearch]);

	const groupedBasicRepositories = useMemo(
		() =>
			filteredBasicRepositories.reduce<Record<string, RemoteRepository[]>>((groups, repository) => {
				const owner = repository.owner.login || 'unknown';
				groups[owner] = groups[owner] ? [...groups[owner], repository] : [repository];
				return groups;
			}, {}),
		[filteredBasicRepositories]
	);

	const groupedEnterpriseRepositories = useMemo(
		() =>
			filteredEnterpriseRepositories.reduce<Record<string, RemoteRepository[]>>((groups, repository) => {
				const owner = repository.owner.login || 'unknown';
				groups[owner] = groups[owner] ? [...groups[owner], repository] : [repository];
				return groups;
			}, {}),
		[filteredEnterpriseRepositories]
	);

	const selectedRepository = useMemo(() => {
		if (!activeRepositoryState.selectedRepoId) return null;
		return activeRepositoryState.items.find((repository) => repository.id === activeRepositoryState.selectedRepoId) ?? null;
	}, [activeRepositoryState.items, activeRepositoryState.selectedRepoId]);

	const activeGroupedRepositories = activeTab === 'basic' ? groupedBasicRepositories : groupedEnterpriseRepositories;
	const activeRepositoryEntries = useMemo(
		() => Object.entries(activeGroupedRepositories),
		[activeGroupedRepositories]
	);
	const showListLoadingStatus = activeRepositoryState.isLoading;
	const showEmptyRepositoryState = activeRepositoryEntries.length === 0 && !activeRepositoryState.isLoading;

	const runCloneForRepositoryTab = useCallback(async () => {
		if (!activeProfile?.id) {
			return;
		}

		if (!selectedRepository) {
			setActiveRepositoryState((current) => ({
				...current,
				cloneError: 'Select a repository before cloning.',
			}));
			return;
		}

		const destinationPath = activeRepositoryState.destinationPath.trim();
		if (!destinationPath) {
			setActiveRepositoryState((current) => ({
				...current,
				cloneError: 'Choose a destination folder before cloning.',
			}));
			return;
		}

		setIsCloning(true);
		setActiveRepositoryState((current) => ({ ...current, cloneError: null }));

		try {
			const response = await invoke<CloneRemoteRepositoryResult>('clone_remote_repository', {
				profileId: activeProfile.id,
				owner: selectedRepository.owner.login,
				repoName: selectedRepository.name,
				branch: activeRepositoryState.selectedBranch || selectedRepository.default_branch || 'main',
				destinationPath,
			});

			await hydrateFromBackend();
			await hydrateQuickFilterMetadata();

			addToast({
				title: 'Repository cloned',
				message: response.message,
				variant: 'success',
				target: 'both',
				duration: 7000,
			});

			onClose();
		} catch (error) {
			const message = extractErrorMessage(error, 'The repository could not be cloned.');
			setActiveRepositoryState((current) => ({
				...current,
				cloneError: message,
			}));

			addToast({
				title: 'Clone failed',
				message,
				variant: 'error',
				target: 'both',
				duration: 8000,
			});
		} finally {
			setIsCloning(false);
		}
	}, [
		activeProfile?.id,
		activeRepositoryState.destinationPath,
		activeRepositoryState.selectedBranch,
		addToast,
		hydrateFromBackend,
		hydrateQuickFilterMetadata,
		onClose,
		selectedRepository,
		setActiveRepositoryState,
	]);

	const runCloneFromUrl = useCallback(async () => {
		if (!activeProfile?.id) {
			return;
		}

		const trimmedUrl = urlInput.trim();
		if (!isValidRemoteUrl(trimmedUrl)) {
			setUrlError('Enter a valid repository URL that starts with https://, http://, or git@.');
			return;
		}

		const trimmedDestination = urlDestinationPath.trim();
		if (!trimmedDestination) {
			setUrlCloneError('Choose a destination folder before cloning.');
			return;
		}

		setIsCloning(true);
		setUrlCloneError(null);

		try {
			const response = await invoke<CloneRemoteRepositoryResult>('clone_remote_repository', {
				profileId: activeProfile.id,
				repoUrl: trimmedUrl,
				branch: urlBranchInput.trim() || 'main',
				destinationPath: trimmedDestination,
			});

			await hydrateFromBackend();
			await hydrateQuickFilterMetadata();

			addToast({
				title: 'Repository cloned',
				message: response.message,
				variant: 'success',
				target: 'both',
				duration: 7000,
			});

			onClose();
		} catch (error) {
			const message = extractErrorMessage(error, 'The repository could not be cloned.');
			setUrlCloneError(message);
			addToast({
				title: 'Clone failed',
				message,
				variant: 'error',
				target: 'both',
				duration: 8000,
			});
		} finally {
			setIsCloning(false);
		}
	}, [
		activeProfile?.id,
		addToast,
		hydrateFromBackend,
		hydrateQuickFilterMetadata,
		onClose,
		urlBranchInput,
		urlDestinationPath,
		urlInput,
	]);

	const pickDestination = useCallback(
		async (target: 'basic' | 'enterprise' | 'url') => {
			try {
				const selected = await open({
					directory: true,
					multiple: false,
					title: 'Select Clone Destination',
				});

				if (typeof selected !== 'string') {
					return;
				}

				if (target === 'url') {
					setUrlDestinationPath(selected);
					setUrlCloneError(null);
					return;
				}

				const setState = target === 'enterprise' ? setEnterpriseState : setBasicState;
				setState((current) => ({
					...current,
					destinationPath: selected,
					cloneError: null,
				}));
			} catch (error) {
				console.error('Failed to select destination path:', error);
			}
		},
		[]
	);

	useEffect(() => {
		isOpenRef.current = isOpen;
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		listRequestKeyRef.current.basic += 1;
		listRequestKeyRef.current.enterprise += 1;
		branchRequestKeyRef.current.basic += 1;
		branchRequestKeyRef.current.enterprise += 1;

		setActiveTab('basic');
		setOpenInfoRepoId(null);
		setBasicState((current) => ({
			...current,
			search: '',
			selectedRepoId: null,
			selectedBranch: 'main',
			branchOptions: [],
			branchError: null,
			destinationPath: '',
			cloneError: null,
		}));
		setEnterpriseState(createInitialListState());
		setUrlInput('');
		setUrlBranchInput('main');
		setUrlDestinationPath('');
		setUrlError(null);
		setUrlCloneError(null);
		setIsCloning(false);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !isEnterpriseConfigured || !activeProfile?.id) {
			return;
		}

		if (activeTab !== 'enterprise') {
			return;
		}

		if (!enterpriseState.hasLoadedOnce && !enterpriseState.isLoading) {
			void fetchRepositoryPage('enterprise', 'reset');
		}
	}, [
		activeProfile?.id,
		activeTab,
		enterpriseState.hasLoadedOnce,
		enterpriseState.isLoading,
		fetchRepositoryPage,
		isEnterpriseConfigured,
		isOpen,
	]);

	useEffect(() => {
		if (!isOpen || activeTab !== 'basic' || !basicLoadMoreRef.current) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				if (
					githubRepositories.isLoading ||
					githubRepositories.isRefreshing ||
					githubRepositories.isLoadingMore ||
					githubRepositories.error ||
					!githubRepositories.hasMore ||
					!canUseRemoteClone
				) {
					return;
				}
				void githubRepositories.loadMore();
			},
			{ root: null, threshold: 0.2 }
		);

		observer.observe(basicLoadMoreRef.current);
		return () => observer.disconnect();
	}, [
		activeTab,
		canUseRemoteClone,
		githubRepositories.error,
		githubRepositories.hasMore,
		githubRepositories.isLoading,
		githubRepositories.isLoadingMore,
		githubRepositories.isRefreshing,
		githubRepositories.loadMore,
	]);

	useEffect(() => {
		if (!isOpen || activeTab !== 'enterprise' || !enterpriseLoadMoreRef.current) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				if (enterpriseState.isLoading || enterpriseState.error || !enterpriseState.hasMore || !isEnterpriseConfigured) return;
				void fetchRepositoryPage('enterprise', 'append');
			},
			{ root: null, threshold: 0.2 }
		);

		observer.observe(enterpriseLoadMoreRef.current);
		return () => observer.disconnect();
	}, [activeTab, enterpriseState.error, enterpriseState.hasMore, enterpriseState.isLoading, fetchRepositoryPage, isEnterpriseConfigured]);

	useEffect(() => {
		if (!openInfoRepoId) {
			return;
		}

		const handlePointerDown = (event: MouseEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest('[data-repo-info-trigger]')) return;
			if (infoPopoverRef.current?.contains(target ?? null)) return;
			setOpenInfoRepoId(null);
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpenInfoRepoId(null);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		window.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			window.removeEventListener('keydown', handleEscape);
		};
	}, [openInfoRepoId]);

	useEffect(() => {
		setOpenInfoRepoId(null);
		if (activeTab !== 'url') {
			setUrlError(null);
			setUrlCloneError(null);
		}
	}, [activeTab]);

	const handleRefresh = () => {
		if (activeTab === 'url') return;
		if (activeTab === 'basic') {
			void githubRepositories.reload();
			return;
		}
		branchRequestKeyRef.current[activeTab] += 1;
		void fetchRepositoryPage(activeTab, 'reset', { force: true });
	};

	const handleClearRepositorySearch = () => {
		setActiveRepositoryState((current) => ({
			...current,
			search: '',
		}));
	};

	const footer =
		activeTab === 'url'
			? (
				<>
					<button
						type="button"
						className="clone-remote-btn clone-remote-btn--secondary"
						style={secondaryButtonStyle}
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						type="button"
						className="clone-remote-btn clone-remote-btn--primary"
						style={primaryButtonStyle}
						onClick={() => void runCloneFromUrl()}
						disabled={isCloning || !canUseRemoteClone}
					>
						{isCloning ? 'Cloning…' : 'Clone'}
					</button>
				</>
			)
			: !isEnterpriseConfigured && activeTab === 'enterprise'
				? (
					<button
						type="button"
						className="clone-remote-btn clone-remote-btn--secondary"
						style={secondaryButtonStyle}
						onClick={onClose}
					>
						Cancel
					</button>
				)
				: (
					<>
						<div style={footerFieldStyle}>
							<span style={footerLabelStyle}>Branch</span>
							<select
								value={activeRepositoryState.selectedBranch}
								onChange={(event) => {
									const next = event.target.value;
									setActiveRepositoryState((current) => ({
										...current,
										selectedBranch: next,
										cloneError: null,
									}));
								}}
								disabled={!selectedRepository || activeRepositoryState.isBranchLoading || isCloning}
									className="clone-remote-input clone-remote-select"
								style={inputStyle}
							>
								<option value="">{activeRepositoryState.isBranchLoading ? 'Loading branches…' : 'Select branch'}</option>
								{activeRepositoryState.branchOptions.map((branch) => (
									<option key={branch.name} value={branch.name}>
										{branch.name}
									</option>
								))}
							</select>
						</div>

						<div style={footerFieldStyle}>
							<span style={footerLabelStyle}>Destination</span>
							<div style={{ display: 'flex', gap: 8 }}>
								<input
									type="text"
									value={activeRepositoryState.destinationPath}
									onChange={(event) => {
										const next = event.target.value;
										setActiveRepositoryState((current) => ({
											...current,
											destinationPath: next,
											cloneError: null,
										}));
									}}
									placeholder="C:/Users/you/projects"
										className="clone-remote-input"
									style={inputStyle}
									disabled={isCloning}
								/>
								<button
									type="button"
										className="clone-remote-btn clone-remote-btn--icon"
									style={iconButtonStyle}
									onClick={() => void pickDestination(activeTab)}
									disabled={isCloning}
									aria-label="Choose destination"
								>
									<FolderOpen size={16} weight="bold" />
								</button>
							</div>
						</div>

						<button
							type="button"
							className="clone-remote-btn clone-remote-btn--secondary"
							style={secondaryButtonStyle}
							onClick={onClose}
							disabled={isCloning}
						>
							Cancel
						</button>
						<button
							type="button"
							className="clone-remote-btn clone-remote-btn--primary"
							style={primaryButtonStyle}
							onClick={() => void runCloneForRepositoryTab()}
							disabled={
								isCloning ||
								!selectedRepository ||
								!activeRepositoryState.destinationPath.trim() ||
								!canUseRemoteClone
							}
						>
							{isCloning ? 'Cloning…' : 'Clone'}
						</button>
					</>
				);

	return (
		<RepositoryModalShell
			isOpen={isOpen}
			onClose={onClose}
			title="Clone Remote Repository"
			description="Use your active profile to clone repositories from GitHub or GitHub Enterprise."
			size="wide"
			footer={footer}
		>
			<div style={{ display: 'grid', gap: 10, paddingBottom: 12 }}>
				{!canUseRemoteClone ? (
					<div style={errorBannerStyle}>
						The active profile must be full OAuth with a healthy token before remote cloning is available.
					</div>
				) : null}

				<div style={tabBarStickyStyle}>
					<div style={{ display: 'flex', gap: 6 }}>
						<button
							type="button"
							className={`clone-remote-btn clone-remote-btn--tab ${activeTab === 'basic' ? 'is-active' : ''}`}
							style={activeTab === 'basic' ? activeTabButtonStyle : tabButtonStyle}
							onClick={() => setActiveTab('basic')}
						>
							Basic Clone
						</button>
						<button
							type="button"
							className={`clone-remote-btn clone-remote-btn--tab ${activeTab === 'enterprise' ? 'is-active' : ''}`}
							style={activeTab === 'enterprise' ? activeTabButtonStyle : tabButtonStyle}
							onClick={() => setActiveTab('enterprise')}
						>
							Enterprise Clone
						</button>
						<button
							type="button"
							className={`clone-remote-btn clone-remote-btn--tab ${activeTab === 'url' ? 'is-active' : ''}`}
							style={activeTab === 'url' ? activeTabButtonStyle : tabButtonStyle}
							onClick={() => setActiveTab('url')}
						>
							Clone from URL
						</button>
					</div>

					{activeTab !== 'url' ? (
						<button
							type="button"
							onClick={handleRefresh}
							className="clone-remote-btn clone-remote-btn--icon"
							style={iconButtonStyle}
							disabled={!canUseRemoteClone}
							aria-label="Refresh repositories"
						>
							<ArrowsClockwise
								size={16}
								weight="bold"
								style={isAnyFetchInProgress ? { animation: 'spin-kf 1s linear infinite' } : undefined}
							/>
						</button>
					) : null}
				</div>

				{activeTab !== 'url' ? (
					<p style={statusTextStyle}>
						Last updated: {activeTab === 'basic' ? basicLastUpdatedLabel : enterpriseLastUpdatedLabel}
						{activeTab === 'basic' && githubRepositories.isUsingCache ? ' (cached)' : ''}
					</p>
				) : null}

				{activeTab === 'url' ? (
					<div style={urlFormStyle}>
						<label style={fieldLabelStyle}>
							<span>Repository URL</span>
							<input
								type="text"
								value={urlInput}
								onChange={(event) => {
									setUrlInput(event.target.value);
									setUrlError(null);
									setUrlCloneError(null);
								}}
								onBlur={() => {
									if (!urlInput.trim()) {
										setUrlError('Repository URL is required.');
										return;
									}

									if (!isValidRemoteUrl(urlInput)) {
										setUrlError('Enter a valid URL starting with https://, http://, or git@.');
										return;
									}

									setUrlError(null);
								}}
								placeholder="https://github.com/owner/repo.git"
								className="clone-remote-input"
								style={inputStyle}
								disabled={isCloning}
							/>
						</label>

						<label style={fieldLabelStyle}>
							<span>Branch</span>
							<input
								type="text"
								value={urlBranchInput}
								onChange={(event) => setUrlBranchInput(event.target.value)}
								placeholder="main"
								className="clone-remote-input"
								style={inputStyle}
								disabled={isCloning}
							/>
						</label>

						<label style={fieldLabelStyle}>
							<span>Destination</span>
							<div style={{ display: 'flex', gap: 8 }}>
								<input
									type="text"
									value={urlDestinationPath}
									onChange={(event) => {
										setUrlDestinationPath(event.target.value);
										setUrlCloneError(null);
									}}
									placeholder="C:/Users/you/projects"
										className="clone-remote-input"
									style={inputStyle}
									disabled={isCloning}
								/>
								<button
									type="button"
									className="clone-remote-btn clone-remote-btn--icon"
									style={iconButtonStyle}
									onClick={() => void pickDestination('url')}
									disabled={isCloning}
									aria-label="Choose destination"
								>
									<FolderOpen size={16} weight="bold" />
								</button>
							</div>
						</label>

						{urlError ? <p style={errorTextStyle}>{urlError}</p> : null}
						{urlCloneError ? <p style={errorTextStyle}>{urlCloneError}</p> : null}
					</div>
				) : activeTab === 'enterprise' && !isEnterpriseConfigured ? (
					<div style={enterpriseLockedContainerStyle}>
						<p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)', textAlign: 'center' }}>
							Enterprise cloning requires an active full OAuth profile with an enterprise API base URL.
						</p>
						<button
							type="button"
							className="clone-remote-btn clone-remote-btn--secondary"
							style={secondaryButtonStyle}
							onClick={onOpenProfileManagement}
						>
							Open Profile Management
						</button>
					</div>
				) : (
					<div style={{ display: 'grid', gap: 10 }}>
						<SearchBar
						value={activeRepositoryState.search}
						onChange={(next) => {
							setActiveRepositoryState((current) => ({
								...current,
								search: next,
							}));
						}}
						onClear={handleClearRepositorySearch}
						placeholder="Search by name, owner, or description"
						label="Search repositories"
						ariaLabel="Search repositories"
						containerStyle={{ width: '100%' }}
						inputStyle={{ background: 'var(--app-surface)', paddingLeft: 32, paddingRight: 32 }}
						clearButtonClassName="clone-remote-search-clear"
						helperText="Use the repository name, owner, or description to narrow the list"
						/>

						{activeRepositoryState.error ? (
							<div style={errorBannerStyle}>
								<span>{activeRepositoryState.error}</span>
								<button
									type="button"
									className="clone-remote-btn clone-remote-btn--secondary"
									style={secondaryButtonStyle}
									onClick={() =>
										void (activeTab === 'basic'
											? githubRepositories.reload()
											: fetchRepositoryPage(activeTab, 'reset', { force: true }))
									}
									disabled={activeRepositoryState.isLoading}
								>
									Retry
								</button>
							</div>
						) : null}

						<div style={listContainerStyle}>
							{showListLoadingStatus ? (
								<p style={loadingStatusStyle} data-testid="repository-loading-status">
									<ArrowsClockwise size={14} weight="bold" style={{ animation: 'spin-kf 1s linear infinite' }} />
									Loading repositories…
								</p>
							) : null}

							{showEmptyRepositoryState ? (
								<p style={{ margin: 0, fontSize: 12, color: 'var(--app-muted)' }}>
									No repositories loaded yet.
								</p>
							) : null}

							{activeRepositoryEntries.map(
								([ownerLogin, repositories]) => (
									<div key={ownerLogin} style={{ display: 'grid', gap: 6 }}>
										<p style={{ margin: '6px 0 0', fontSize: 11, textTransform: 'uppercase', color: 'var(--app-muted)' }}>
											{ownerLogin}
										</p>

										{repositories.map((repository) => {
											const isSelected = activeRepositoryState.selectedRepoId === repository.id;
											return (
												<div
													key={repository.id}
													onClick={() => handleSelectRepository(activeTab, repository)}
													style={{
														...repositoryRowStyle,
														...(isSelected ? selectedRepositoryRowStyle : undefined),
													}}
												>
													<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
														{repository.private ? <Lock size={14} weight="bold" /> : <BookOpen size={14} weight="bold" />}
														<div style={{ display: 'grid', gap: 2 }}>
															<strong style={{ fontSize: 13 }}>{repository.name}</strong>
															<span style={{ fontSize: 11, color: 'var(--app-muted)' }}>{repository.full_name}</span>
														</div>
													</div>

													<div style={{ position: 'relative' }}>
														<button
															type="button"
															data-repo-info-trigger
															onClick={(event) => {
																event.stopPropagation();
																setOpenInfoRepoId((current) => (current === repository.id ? null : repository.id));
															}}
															className="clone-remote-btn clone-remote-btn--icon"
															style={iconButtonStyle}
															aria-label={`Repository details for ${repository.full_name}`}
														>
															<Info size={14} weight="bold" />
														</button>

														{openInfoRepoId === repository.id ? (
															<div ref={infoPopoverRef} data-remote-info-popover style={infoPopoverStyle}>
																<p style={infoTitleStyle}>{repository.full_name}</p>
																<p style={infoRowStyle}>Visibility: {repository.private ? 'Private' : 'Public'}</p>
																<p style={infoRowStyle}>Default branch: {repository.default_branch || 'main'}</p>
																<p style={infoRowStyle}>Updated: {repository.updated_at || 'Unknown'}</p>
																<p style={infoRowStyle}>{repository.description || 'No description.'}</p>
															</div>
														) : null}
													</div>
												</div>
											);
										})}
									</div>
								)
							)}

							<div ref={activeTab === 'basic' ? basicLoadMoreRef : enterpriseLoadMoreRef} style={{ height: 1 }} />
						</div>

						{activeRepositoryState.branchError ? <p style={errorTextStyle}>{activeRepositoryState.branchError}</p> : null}
						{activeRepositoryState.cloneError ? <p style={errorTextStyle}>{activeRepositoryState.cloneError}</p> : null}
					</div>
				)}
			</div>
		</RepositoryModalShell>
	);
}

const inputStyle: React.CSSProperties = {
	width: '100%',
	boxSizing: 'border-box',
	borderRadius: 8,
	padding: '8px 10px',
	fontSize: 13,
	color: 'var(--app-text)',
};

const baseInteractiveStyle: React.CSSProperties = {
	borderRadius: 8,
	transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease',
};

const primaryButtonStyle: React.CSSProperties = {
	...baseInteractiveStyle,
	padding: '8px 12px',
	cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
	...baseInteractiveStyle,
	padding: '8px 12px',
	cursor: 'pointer',
};

const iconButtonStyle: React.CSSProperties = {
	...baseInteractiveStyle,
	padding: '8px 10px',
	cursor: 'pointer',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
};

const fieldLabelStyle: React.CSSProperties = {
	display: 'grid',
	gap: 6,
	fontSize: 12,
	color: 'var(--app-text)',
	fontWeight: 600,
};

const tabButtonStyle: React.CSSProperties = {
	padding: '7px 10px',
	borderRadius: 8,
	fontSize: 12,
	cursor: 'pointer',
};

const activeTabButtonStyle: React.CSSProperties = {
	...tabButtonStyle,
};

const tabBarStickyStyle: React.CSSProperties = {
	position: 'sticky',
	top: 0,
	zIndex: 2,
	background: 'var(--app-surface)',
	borderBottom: '1px solid var(--app-border)',
	paddingBottom: 8,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
};

const urlFormStyle: React.CSSProperties = {
	display: 'grid',
	gap: 10,
};

const listContainerStyle: React.CSSProperties = {
	display: 'grid',
	gap: 8,
	maxHeight: 380,
	overflowY: 'auto',
	border: '1px solid var(--app-border)',
	borderRadius: 10,
	padding: 8,
};

const loadingStatusStyle: React.CSSProperties = {
	margin: 0,
	fontSize: 12,
	color: 'var(--app-muted)',
	display: 'inline-flex',
	alignItems: 'center',
	gap: 6,
	minHeight: 20,
};

const repositoryRowStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: 10,
	border: '1px solid var(--app-border)',
	borderRadius: 8,
	background: 'var(--app-surface-muted)',
	padding: '8px 10px',
	cursor: 'pointer',
	minHeight: 46,
};

const selectedRepositoryRowStyle: React.CSSProperties = {
	borderColor: 'var(--app-accent)',
	boxShadow: 'inset 3px 0 0 var(--app-accent)',
	background: 'color-mix(in srgb, var(--app-accent) 10%, var(--app-surface-muted))',
};

const infoPopoverStyle: React.CSSProperties = {
	position: 'absolute',
	right: 0,
	top: 'calc(100% + 6px)',
	width: 280,
	borderRadius: 10,
	border: '1px solid var(--app-border)',
	background: 'var(--app-surface)',
	boxShadow: '0 20px 35px -24px rgba(15, 23, 42, 0.7)',
	padding: 10,
	display: 'grid',
	gap: 4,
	zIndex: 20,
};

const infoTitleStyle: React.CSSProperties = {
	margin: 0,
	fontSize: 12,
	fontWeight: 700,
	color: 'var(--app-text)',
};

const infoRowStyle: React.CSSProperties = {
	margin: 0,
	fontSize: 11,
	color: 'var(--app-muted)',
};

const enterpriseLockedContainerStyle: React.CSSProperties = {
	minHeight: 260,
	display: 'grid',
	placeContent: 'center',
	gap: 10,
	justifyItems: 'center',
};

const errorBannerStyle: React.CSSProperties = {
	border: '1px solid color-mix(in srgb, var(--app-danger) 55%, var(--app-border))',
	background: 'color-mix(in srgb, var(--app-danger) 12%, transparent)',
	color: 'var(--app-text)',
	borderRadius: 8,
	padding: '8px 10px',
	fontSize: 12,
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	gap: 10,
};

const errorTextStyle: React.CSSProperties = {
	margin: 0,
	fontSize: 12,
	color: '#ef4444',
};

const footerFieldStyle: React.CSSProperties = {
	minWidth: 180,
	display: 'grid',
	gap: 4,
};

const footerLabelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 700,
	color: 'var(--app-muted)',
};

const statusTextStyle: React.CSSProperties = {
	margin: '0 0 2px',
	fontSize: 11,
	color: 'var(--app-muted)',
};
