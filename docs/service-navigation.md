# My services navigation

Developer Portal follows a workspace-first navigation model:
- **My services:** Only enabled modules for the selected project. A persistent Add or manage services link opens the module marketplace.
- **Platform APIs:** Full public API reference remains visible for discovery and troubleshooting. This avoids hiding docs from developers.
- **Vedoy Spotlight:** Reserved future module, **not** advertised as installable until its API, billing and permissions are ready.
- **Vedoy Monetize:** Statistics and Advertize appear in My services only after activation through server-authorized module endpoints; currently catalog-only/planned.
- **Project switching:** My services resets immediately and updates after project module data loads, preventing services from one project leaking into another project's UI.
- **Auth:** Never infer permission from navigation visibility; every request must be authorized server-side.

Follow-up architecture: organization/project/environment picker, service-specific route pages, per-project pinned services and roles. The current My services links open the existing module management page, not independent product dashboards.
