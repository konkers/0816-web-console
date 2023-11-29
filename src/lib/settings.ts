import { Result } from "@badrap/result";

export interface Settings {
	advanced_angle?: number;
	half_advanced_angle?: number,
	retract_angle?: number,
	feed_length?: number,
	settle_time?: number,
	pwm_0?: number,
	pwm_180?: number,
	ignore_feedback_pin?: boolean,
}

const settingsRegex = /M620 (.*)/;
const whitespaceRegex = /\s+/;
// M618 N1 A135 B107.5 C80 F2 U300 V490.2 W980.4 X0
export function parseFeederConfig(response: string): Result<[number, Settings]> {
	console.log(response);
	const matches = response.match(settingsRegex);
	console.log(matches);
	if (!matches) {
		return Result.err();
	}
	const attrs = matches[1].split(whitespaceRegex);
	console.log(attrs);

	let settings: Settings = {};
	let feeder_index = -1;
	for (const index in attrs) {
		const attr = attrs[index];

		console.log(attr);
		const code = attr[0];
		const value = attr.slice(1);
		if (code === "N") {
			feeder_index = parseInt(value)
		} else if (code === "A") {
			settings.advanced_angle = parseFloat(value);
		} else if (code === "B") {
			settings.half_advanced_angle = parseFloat(value);
		} else if (code === "C") {
			settings.retract_angle = parseFloat(value);
		} else if (code === "F") {
			settings.feed_length = parseFloat(value);
		} else if (code === "U") {
			settings.settle_time = parseFloat(value);
		} else if (code === "V") {
			settings.pwm_0 = parseFloat(value);
		} else if (code === "W") {
			settings.pwm_180 = parseFloat(value);
		} else if (code === "X") {
			settings.ignore_feedback_pin = parseInt(value) != 0;
		} else {
			console.log(`unknown code ${code}`);
			return Result.err();
		}
	}

	if (feeder_index === -1) {
		return Result.err();
	}

	return Result.ok([feeder_index, settings]);
}

export function gcodeForSettings(index: number, settings: Settings): string {
	if (settings === undefined) {
		return ""
	}
	let gcode = `M620 N${index}`;

	if (settings.advanced_angle) {
		gcode += ` A${settings.advanced_angle}`;
	}
	if (settings.half_advanced_angle) {
		gcode += ` B${settings.half_advanced_angle}`;
	}
	if (settings.retract_angle) {
		gcode += ` C${settings.retract_angle}`;
	}
	if (settings.feed_length) {
		gcode += ` F${settings.feed_length}`;
	}
	if (settings.settle_time) {
		gcode += ` U${settings.settle_time}`;
	}
	if (settings.pwm_0) {
		gcode += ` V${settings.pwm_0}`;
	}
	if (settings.pwm_180) {
		gcode += ` W${settings.pwm_180}`;
	}
	if (settings.ignore_feedback_pin != null) {
		if (settings.ignore_feedback_pin) {
			gcode += ` X1`;
		} else {
			gcode += ` X0`;
		}
	}

	return gcode;
}
