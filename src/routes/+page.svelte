<script lang="ts">
	import { onMount } from 'svelte';
	import { Result } from '@badrap/result';

	import { gcodeForSettings, parseFeederConfig, type Settings } from '$lib/settings';
	import CheckboxInput from '$lib/components/checkbox_input.svelte';
	import NumberInput from '$lib/components/number_input.svelte';
	import SliderInput from '$lib/components/slider_input.svelte';

	let notSupported: boolean = false;
	let connected: boolean = false;
	let port: SerialPort;
	let inputDone: Promise<void>;
	let inputStream: ReadableStream<string>;
	let outputDone: Promise<void>;
	let outputStream: WritableStream<string>;

	const errorRegex = /.*error[^\n]*\n/;
	const okRegex = /.*ok[^\n]*\n/;

	let serialLog: string = '';
	let logElement: Element;

	let errorText: string = '';

	let progressText: string = '';
	let progressShown: boolean = false;

	let readBuffer: string = '';

	let feeders: Array<Settings> = [];
	let selectedFeeder: number = 0;
	let feederAngleEnable: boolean = false;
	let feederAngles: Array<number> = [];
	let feederAdvanceValues: Array<number> = [];
	let gcodeSetting: string = '';

	$: gcodeSetting = gcodeForSettings(selectedFeeder, feeders[selectedFeeder]);

	$: if (serialLog && logElement) {
		logElement.scroll({ top: logElement.scrollHeight, behavior: 'smooth' });
	}

	$: if (feederAngleEnable) {
		executeGCode(`M603 N${selectedFeeder} A${feederAngles[selectedFeeder]}`);
	}

	onMount(() => {
		notSupported = !('serial' in navigator);
	});

	async function connect() {
		try {
			port = await navigator.serial.requestPort();
			console.log(port);
			// - Wait for the port to open.
			await port.open({ baudRate: 115200 });
			console.log(port);
		} catch {
			errorText = "Couldn't open serial port.";
			return;
		}

		if (port.readable === null) {
			errorText = 'Serial port is not readable.';
			disconnect();
			return;
		}
		if (port.writable === null) {
			errorText = 'Serial port is not writeable';
			disconnect();
			return;
		}

		let decoder = new TextDecoderStream();
		inputDone = port.readable.pipeTo(decoder.writable);
		inputStream = decoder.readable;

		const encoder = new TextEncoderStream();
		outputDone = encoder.readable.pipeTo(port.writable);
		outputStream = encoder.writable;

		connected = true;

		const discovered = await discoverFeeders();
		if (discovered.isErr) {
			errorText = `Failed to discover feeders: ${discovered.error}`;
			disconnect();
			return;
		}

		feeders = discovered.value;
		feederAngles = feeders.map((feeder) => 90.0);
		feederAdvanceValues = feeders.map((feeder) => (feeder.feed_length ? feeder.feed_length : 4));

		await executeGCode('M610 S1');
	}

	async function disconnect() {
		if (connected === true) {
			inputStream.cancel();
			await inputDone.catch(() => {});
			outputStream.close();
			await outputDone;
			port.close();

			feeders = [];

			feederAngleEnable = false;
			connected = false;
		}
	}

	async function executeGCode(gcode: string): Promise<string> {
		if (!outputStream) {
			return '';
		}

		// Send gcode.
		const writer = outputStream.getWriter();
		console.log('gcode: ', gcode);
		writer.write(gcode + '\n');
		writer.releaseLock();

		let reader = inputStream.getReader();
		let response = '';
		while (true) {
			const { value, done } = await reader.read();
			if (value) {
				console.log('response: ' + value);
				response += value;
				serialLog += value;

				if (okRegex.test(response) || errorRegex.test(response)) {
					break;
				}
			}
			if (done) {
				console.log('got done while reading');
				break;
			}
		}
		reader.releaseLock();

		return response;
	}

	const asyncCallWithTimeout = async (asyncPromise: Promise<any>, timeLimit: number) => {
		let timeoutHandle: number;

		const timeoutPromise = new Promise((_resolve, reject) => {
			timeoutHandle = setTimeout(
				() => reject(new Error('Async call timeout limit reached')),
				timeLimit
			);
		});

		return Promise.race([asyncPromise, timeoutPromise]).then((result) => {
			clearTimeout(timeoutHandle);
			return result;
		});
	};

	async function readLine(): Promise<Result<string>> {
		let reader = inputStream.getReader();
		while (true) {
			try {
				// Consume any lines in buffer before trying to read new ones.
				const newline_index = readBuffer.indexOf('\n');
				if (newline_index >= 0) {
					const line = readBuffer.slice(0, newline_index);
					readBuffer = readBuffer.slice(newline_index + 1);
					reader.releaseLock();
					return Result.ok(line);
				}

				const { value, done } = await asyncCallWithTimeout(reader.read(), 2000);

				if (done) {
					console.log('got done while reading');
					reader.releaseLock();
					return Result.err();
				}

				serialLog += value;

				readBuffer += value;
			} catch (err) {
				// Return empty string on timeout.
				reader.releaseLock();
				return Result.ok('');
			}
		}
	}

	async function discoverFeeders(): Promise<Result<Array<Settings>>> {
		let feeders: Array<Settings> = [];
		progressText = 'Discovering Feeders';
		progressShown = true;
		const knownReadyLines = ['Controller up and ready! Have fun.', 'ready'];
		while (true) {
			const line = await readLine();
			if (line.isErr) {
				return Result.err(line.error);
			}
			if (line.value === '') {
				// Emtpy string is a timeout.  Return then already discovered feeders.
				break;
			}

			if (knownReadyLines.includes(line.value)) {
				break;
			}

			const config = parseFeederConfig(line.value);
			if (config.isErr) {
				// slip lines that do not parse;
				continue;
			}
			const index = config.value[0];
			const settings = config.value[1];

			if (index != feeders.length) {
				return Result.err(new Error('Feeder list out of order'));
			}

			feeders.push(settings);
		}
		progressShown = false;
		console.log(feeders);

		return Result.ok(feeders);
	}

	function clearError() {
		errorText = '';
	}

	async function advanceFeeder() {
		await executeGCode(`M600 N${selectedFeeder} F${feederAdvanceValues[selectedFeeder]}`);
	}
	async function updateSettings() {
		await executeGCode(gcodeSetting);
	}
</script>

<nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark">
	<div class="container-fluid">
		<span class="navbar-brand"
			><a href="https://github.com/konkers/0816-web-console"><i class="bi me-2 bi-github"></i></a
			>0816 Feeder Console</span>
		<form class="d-flex">
			<select class="me-2" hidden={!connected || feeders.length <= 0} bind:value={selectedFeeder}>
				{#each feeders as _, i}
					<option value={i}>Feeder {i}</option>
				{/each}
			</select>
			<button hidden={connected} class="btn btn-primary" on:click={connect}>Connect</button>
			<button hidden={!connected} class="btn btn-primary" on:click={disconnect}>Disconnect</button>
		</form>
	</div>
</nav>
<main class="container">
	{#if progressShown}
		<div class="card m-3">
			<div class="card-body">
				<h5 class="card-title">
					{progressText}
				</h5>
				<div class="progress" role="progressbar">
					<div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%">
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if feeders.length > 0}
		<div class="card m-3">
			<div class="card-body">
				<h5 class="card-title">Feeder Control</h5>
				<SliderInput
					min="0"
					max="180"
					bind:enabled={feederAngleEnable}
					bind:value={feederAngles[selectedFeeder]}>Servo Angle</SliderInput>
				{#if feederAdvanceValues[selectedFeeder]}
					<div class="input-group mb-3">
						<select class="form-select" bind:value={feederAdvanceValues[selectedFeeder]}>
							<option value={2}>2mm</option>
							<option value={4}>4mm</option>
							<option value={8}>8mm</option>
							<option value={12}>12mm</option>
							<option value={16}>16mm</option>
							<option value={20}>20mm</option>
							<option value={24}>24mm</option>
						</select>
						<button type="submit" class="col-sm-2 btn btn-primary" on:click={advanceFeeder}
							>Advance</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
	{#if feeders.length > 0}
		<div class="card m-3">
			<div class="card-body">
				<h5 class="card-title">Feeder Settings</h5>
				<div class="container">
					<div class="row">
						<div class="col-6">
							<NumberInput bind:value={feeders[selectedFeeder].advanced_angle} units="°"
								>Advanced Angle</NumberInput>
						</div>
						<div class="col-6">
							<NumberInput bind:value={feeders[selectedFeeder].half_advanced_angle} units="°"
								>Half Advanded Angle</NumberInput>
						</div>
					</div>
					<div class="row align-items-center">
						<div class="col-6">
							<NumberInput bind:value={feeders[selectedFeeder].retract_angle} units="°"
								>Retract Angle</NumberInput>
						</div>
						<div class="col-6">
							<NumberInput bind:value={feeders[selectedFeeder].feed_length} units="mm"
								>Default Feed Length</NumberInput>
						</div>
					</div>
					<div class="row align-items-center">
						<div class="col-6">
							<NumberInput bind:value={feeders[selectedFeeder].pwm_0}>Pwm Value at 0°</NumberInput>
						</div>
						<div class="col-6">
							<NumberInput bind:value={feeders[selectedFeeder].settle_time} units="ms"
								>Settle Time</NumberInput>
						</div>
					</div>
					<div class="row align-items-center">
						<div class="col-6">
							<NumberInput bind:value={feeders[selectedFeeder].pwm_180}
								>Pwm Value at 180°</NumberInput>
						</div>
					</div>
					<div class="row align-items-center">
						<div class="col-6">
							<CheckboxInput bind:checked={feeders[selectedFeeder].ignore_feedback_pin}>
								Ignore Feedback Pin?
							</CheckboxInput>
						</div>
						<div class="col-6">
							<CheckboxInput bind:checked={feeders[selectedFeeder].always_retract}>
								Always Retract?
							</CheckboxInput>
						</div>
					</div>
					<div class="row"></div>
					<form class="row align-items-center">
						<div class="col-12">
							<label class="form-label" for="gcode-setting" style="width:100%"
								>GCode Setting

								<div class="input-group mb-3">
									<input
										class="col-sm-10 form-control"
										id="gcode-setting"
										type="text"
										readonly
										bind:value={gcodeSetting} />
									<button type="submit" class="col-sm-2 btn btn-primary" on:click={updateSettings}
										>Save</button>
								</div>
							</label>
						</div>
					</form>
					<div class="row">
						<div class="col-auto"></div>
					</div>
				</div>
			</div>
		</div>
	{/if}
	<div class="card m-3">
		<div class="card-body">
			<h5 class="card-title">Serial Log</h5>
			<textarea class="log form-control" bind:this={logElement} bind:value={serialLog}></textarea>
		</div>
	</div>

	{#if errorText}
		<div class="modal" id="errorModal" tabindex="-1" role="dialog" hidden={false}>
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">Error</h5>
					</div>
					<div class="modal-body">{errorText}</div>
					<div class="modal-footer">
						<button
							type="button"
							class="btn btn-secondary"
							data-dismiss="modal"
							on:click={clearError}>Ok</button>
					</div>
				</div>
			</div>
		</div>
		<div class="modal-backdrop show" />
	{/if}
	{#if notSupported}
		<div class="modal" id="notSupportedModal" tabindex="-1" role="dialog" hidden={false}>
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h1 class="modal-title fs-5" id="notSupportedModalLabel">WebSerial not supported</h1>
					</div>
					<div class="modal-body">
						This browser does not support Web Serial. Please use a recent version of Chrome or Edge.
					</div>
				</div>
			</div>
		</div>
		<div class="modal-backdrop show" />
	{/if}
</main>

<style>
	.log {
		font-family: 'Inconsolata', serif;
		height: 400px;
		width: 100%;
	}

	.modal {
		display: block;
	}
</style>
