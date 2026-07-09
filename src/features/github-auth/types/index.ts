export interface GitHubAppInstallationAccount {
	id?: number;
	login: string;
	type?: string;
	html_url?: string;
	avatar_url?: string;
}

export interface GitHubAppInstallation {
	id: number;
	account: GitHubAppInstallationAccount | null;
	app_slug?: string;
	repository_selection?: string;
	permissions?: Record<string, string>;
	target_type?: string;
	created_at?: string;
	updated_at?: string;
	html_url?: string;
}

export interface GitHubRepositoryOwner {
	login: string;
	id?: number;
	type?: string;
	html_url?: string;
	avatar_url?: string;
}

export interface GitHubRepository {
	id: string;
	name: string;
	full_name: string;
	owner: GitHubRepositoryOwner;
	description: string | null;
	private: boolean;
	default_branch: string;
	updated_at: string;
	clone_url: string;
	ssh_url: string;
	html_url: string;
}

export interface GitHubRepositoryPage {
	items: GitHubRepository[];
	page: number;
	per_page: number;
	has_more: boolean;
}
