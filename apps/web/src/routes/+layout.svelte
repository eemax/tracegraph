<script lang="ts">
  import '../app.css';
  import { Toaster } from '$lib/components/ui/sonner/index.js';
</script>

<slot />
<Toaster position="top-right" richColors closeButton />
