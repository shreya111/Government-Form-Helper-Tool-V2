// FormWise - single place to configure the backend API base URL.
// Keep host_permissions in manifest.json in sync with this origin.
// `var` (not const) so it is reachable as self.FORMWISE_API_BASE_URL from the worker and the panel page.
var FORMWISE_API_BASE_URL = 'https://formwise-demo.preview.emergentagent.com/api';
