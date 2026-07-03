import {
  AppWindow,
  BookOpen,
  Bookmarks,
  Bug,
  Browser,
  ChartBar,
  Cloud,
  Code,
  Cpu,
  Database,
  Desktop,
  Folder,
  Gear,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Globe,
  HardDrive,
  House,
  Key,
  Link,
  List,
  Notebook,
  Package,
  PlugsConnected,
  ShieldCheck,
  Tag,
  Terminal,
  TestTube,
  type Icon,
} from "@phosphor-icons/react";

export const repositoryIconRegistry = {
  // Source control / core
  GitBranch,
  GitCommit,
  GitPullRequest,
  Folder,
  Terminal,
  Code,

  // Infra / data
  Database,
  HardDrive,
  Cloud,
  Cpu,
  ShieldCheck,

  // Logic / organization
  Tag,
  Bookmarks,
  List,
  Link,
  Gear,
  AppWindow,

  // Project / environments
  Globe,
  Browser,
  Package,
  Desktop,
  Bug,
  PlugsConnected,
  TestTube,
  Key,
  ChartBar,
  BookOpen,
  Notebook,
  House,
} satisfies Record<string, Icon>;

export type RepositoryIconName = keyof typeof repositoryIconRegistry;

export const repositoryIconNames = Object.keys(
  repositoryIconRegistry,
) as RepositoryIconName[];
