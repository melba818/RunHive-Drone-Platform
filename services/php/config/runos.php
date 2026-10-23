<?php

return [
    // The default RunOS service is the administrator-1 worker; other accounts
    // receive isolated workers and workspaces on demand.
    'owner_admin_id' => (int)env('runos.owner_admin_id', 1),
];
