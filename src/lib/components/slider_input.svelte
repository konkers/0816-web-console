<script lang="ts">
	export let enabled: boolean | null = null;
	export let value: number | null = null;
	export let min: string | null;
	export let max: string | null;
</script>

{#if value != null}
	<div class="input-group mb-3">
		<div class="input-group-text">
			<input class="form-check-input mt-0" type="checkbox" bind:checked={enabled} />
		</div>
		<span class="col-sm-2 input-group-text"><slot /></span>
		<input class="col-sm-8 range" type="range" {min} {max} bind:value />
		<input class="col-sm-1 form-control" type="number" bind:value />
	</div>
{/if}

<style>
	.range {
		border: 1px solid transparent;
		display: flex;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		background-color: transparent;

		padding: 0.375rem 0.75rem;
		border: var(--bs-border-width) solid var(--bs-border-color);
		cursor: default;
	}
	.range::-webkit-slider-thumb {
		height: 1rem;
		width: 1rem;
		appearance: none;
		margin-top: -0.25rem;
		appearance: none;
		background-color: #0d6efd;
		border: 0;
		border-radius: 1rem;
	}
	.range::-webkit-slider-runnable-track {
		background-color: var(--bs-secondary-bg);
		height: 0.5rem;
		border-radius: 1rem;
	}
</style>
