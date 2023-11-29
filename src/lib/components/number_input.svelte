<script lang="ts">
	export let value: number | undefined;
	export let units: string | undefined = undefined;
</script>

{#if value !== undefined}
	{#if units === undefined}
		<div class="input-group mb-3">
			<span class="col-sm-7 input-group-text"><slot /></span>
			<input type="number" class="col-sm-5 form-control" bind:value />
		</div>
	{/if}
	{#if units !== undefined}
		<div class="input-group mb-3">
			<span class="col-sm-7 input-group-text"><slot /></span>
			<input type="number" class="col-sm-3 form-control" bind:value />
			<span class="col-sm-2 input-group-text">{units}</span>
		</div>
	{/if}
{/if}
