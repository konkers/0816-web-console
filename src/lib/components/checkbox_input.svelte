<script lang="ts">
	export let checked: boolean | null = null;
</script>

{#if checked != null}
	<div class="input-group mb-3">
		<span class="col-sm-7 input-group-text"><slot /></span>
		<select class="col-sm-5 form-select" bind:value={checked}>
			<option value={false}>No</option>
			<option value={true}>Yes</option>
		</select>
		<!--		<div class="form-switch col-sm-5">
			<input class="form-check-input" type="checkbox" role="switch" {id} bind:checked />
		</div>
	-->
	</div>
	<!--<input class="form-check-input" type="checkbox" {id} bind:checked />
	<label for={id} class="form-check-label">
		<slot />
	</label>
-->
{/if}
