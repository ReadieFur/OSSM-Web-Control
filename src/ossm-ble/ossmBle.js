//#region src/helpers.ts
async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
let DOMExceptionError = /* @__PURE__ */ function(DOMExceptionError$1) {
	DOMExceptionError$1["InvalidState"] = "InvalidStateError";
	DOMExceptionError$1["NetworkError"] = "NetworkError";
	DOMExceptionError$1["Timeout"] = "TimeoutError";
	DOMExceptionError$1["TypeError"] = "TypeError";
	DOMExceptionError$1["OperationError"] = "OperationError";
	DOMExceptionError$1["DataError"] = "DataError";
	DOMExceptionError$1["AbortError"] = "AbortError";
	return DOMExceptionError$1;
}({});
function upperSnakeToCamel(str) {
	return str.toLowerCase().split("_").map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)).join("");
}
var AsyncFunctionQueue = class {
	chain = Promise.resolve();
	currentAbort;
	generation = 0;
	withTimeout(p, ms, signal) {
		let timer;
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				reject(signal.reason);
				return;
			}
			const onAbort = () => {
				clearTimeout(timer);
				reject(signal.reason);
			};
			signal?.addEventListener("abort", onAbort, { once: true });
			timer = window.setTimeout(() => reject(new DOMException("Timeout", DOMExceptionError.Timeout)), ms);
			p.then((value) => {
				clearTimeout(timer);
				signal?.removeEventListener("abort", onAbort);
				resolve(value);
			}, (error) => {
				clearTimeout(timer);
				signal?.removeEventListener("abort", onAbort);
				reject(error);
			});
		});
	}
	clearQueue() {
		this.generation++;
		this.currentAbort?.abort(new DOMException("Operation aborted due to queue clear", DOMExceptionError.AbortError));
		this.chain = Promise.resolve();
	}
	enqueue(func) {
		const capturedGeneration = this.generation;
		const task = async () => {
			if (capturedGeneration !== this.generation) throw new DOMException("Queue cleared", "AbortError");
			this.currentAbort = new AbortController();
			try {
				return await func(this.currentAbort.signal);
			} finally {
				this.currentAbort = void 0;
			}
		};
		const next = this.chain.then(task, task);
		this.chain = next.catch(() => {});
		return next;
	}
	enqueueWithTimeout(func, timeoutMs) {
		return this.enqueue((signal) => this.withTimeout(func(signal), timeoutMs, signal));
	}
	/** Force-fail the currently running task */
	abortCurrent(reason = "Operation aborted") {
		this.currentAbort?.abort(new DOMException(reason, DOMExceptionError.AbortError));
	}
};
/** Useful for modifying the speed value for OSSM since it seems to be non-linear */
function mapRational(x, k = 1.8) {
	const n = x / 100;
	return n / (n + k * (1 - n)) * 100;
}

//#endregion
//#region src/ossmBleTypes.ts
let OssmEventType = /* @__PURE__ */ function(OssmEventType$1) {
	/** Emitted when the device is successfully connected */
	OssmEventType$1[OssmEventType$1["Connected"] = 0] = "Connected";
	/** Emitted when the device is disconnected */
	OssmEventType$1[OssmEventType$1["Disconnected"] = 1] = "Disconnected";
	/**
	* Emitted when the device state changes  
	* 
	* Notification Behavior:
	* - State changes trigger immediate notifications
	* - Periodic notifications every 1000ms if no state change
	* - Notifications stop when no clients connected
	*/
	OssmEventType$1[OssmEventType$1["StateChanged"] = 2] = "StateChanged";
	return OssmEventType$1;
}({});
let OssmStatus = /* @__PURE__ */ function(OssmStatus$1) {
	/** Initializing */
	OssmStatus$1["Idle"] = "idle";
	/** Homing sequence active */
	OssmStatus$1["Homing"] = "homing";
	/** Forward homing in progress */
	OssmStatus$1["HomingForward"] = "homing.forward";
	/** Backward homing in progress */
	OssmStatus$1["HomingBackward"] = "homing.backward";
	/** Main menu displayed */
	OssmStatus$1["Menu"] = "menu";
	/** Menu idle state */
	OssmStatus$1["MenuIdle"] = "menu.idle";
	/** Simple penetration mode */
	OssmStatus$1["SimplePenetration"] = "simplePenetration";
	/** Simple penetration idle */
	OssmStatus$1["SimplePenetrationIdle"] = "simplePenetration.idle";
	/** Pre-flight checks */
	OssmStatus$1["SimplePenetrationPreflight"] = "simplePenetration.preflight";
	/** Stroke engine mode */
	OssmStatus$1["StrokeEngine"] = "strokeEngine";
	/** Stroke engine idle */
	OssmStatus$1["StrokeEngineIdle"] = "strokeEngine.idle";
	/** Pre-flight checks */
	OssmStatus$1["StrokeEnginePreflight"] = "strokeEngine.preflight";
	/** Pattern selection */
	OssmStatus$1["StrokeEnginePattern"] = "strokeEngine.pattern";
	/** Update mode */
	OssmStatus$1["Update"] = "update";
	/** Checking for updates */
	OssmStatus$1["UpdateChecking"] = "update.checking";
	/** Update in progress */
	OssmStatus$1["UpdateUpdating"] = "update.updating";
	/** Update idle */
	OssmStatus$1["UpdateIdle"] = "update.idle";
	/** WiFi setup mode */
	OssmStatus$1["Wifi"] = "wifi";
	/** WiFi setup idle */
	OssmStatus$1["WifiIdle"] = "wifi.idle";
	/** Help screen */
	OssmStatus$1["Help"] = "help";
	/** Help idle */
	OssmStatus$1["HelpIdle"] = "help.idle";
	/** Error state */
	OssmStatus$1["Error"] = "error";
	/** Error idle */
	OssmStatus$1["ErrorIdle"] = "error.idle";
	/** Error help */
	OssmStatus$1["ErrorHelp"] = "error.help";
	/** Restart state */
	OssmStatus$1["Restart"] = "restart";
	return OssmStatus$1;
}({});
let OssmPage = /* @__PURE__ */ function(OssmPage$1) {
	/** Switch to simple penetration mode */
	OssmPage$1["SimplePenetration"] = "simplePenetration";
	/** Switch to stroke engine mode */
	OssmPage$1["StrokeEngine"] = "strokeEngine";
	/** Return to main menu */
	OssmPage$1["Menu"] = "menu";
	return OssmPage$1;
}({});
const OSSM_PAGE_NAVIGATION_GRAPH = {
	[OssmPage.Menu]: [OssmPage.SimplePenetration, OssmPage.StrokeEngine],
	[OssmPage.SimplePenetration]: [OssmPage.Menu],
	[OssmPage.StrokeEngine]: [OssmPage.Menu]
};

//#endregion
//#region src/patterns.ts
var PatternHelper = class PatternHelper {
	speed;
	pattern;
	stroke;
	depth;
	sensation = 100;
	constructor(patternId, minDepth, maxDepth, speed, intensity = void 0, invert = void 0) {
		this.patternId = patternId;
		this.minDepth = minDepth;
		this.maxDepth = maxDepth;
		this.intensity = intensity;
		this.invert = invert;
		this.speed = speed;
		if (patternId < 0 || !Number.isInteger(patternId)) throw new RangeError("patternId must be a positive integer.");
		if (this.minDepth < 0 || this.minDepth > 100 || !Number.isInteger(this.minDepth)) throw new RangeError("minDepthAbsolute must be an integer between 0 and 100.");
		if (this.maxDepth < 0 || this.maxDepth > 100 || !Number.isInteger(this.maxDepth)) throw new RangeError("maxDepthAbsolute must be an integer between 0 and 100.");
		if (this.minDepth >= this.maxDepth) throw new RangeError("minDepthAbsolute must be less than maxDepthAbsolute.");
		if (this.speed < 0 || this.speed > 100) throw new RangeError("Speed must be between 0 and 100.");
		this.pattern = this.patternId;
		this.speed = this.speed;
		this.depth = this.maxDepth;
		this.stroke = this.maxDepth - this.minDepth;
		if (this.intensity !== void 0) {
			if (this.intensity < 0 || this.intensity > 100 || !Number.isInteger(this.intensity)) throw new RangeError("Intensity must be an integer between 0 and 100.");
			this.sensation = this.intensity;
		}
		if (this.invert !== void 0) {
			if (this.intensity === void 0) throw new Error("Intensity must be defined for reversible patterns.");
			this.sensation = this.invert ? 50 - Math.round(this.intensity / 2) : 50 + Math.round(this.intensity / 2);
		}
	}
	/**
	* Creates a PatternHelper from raw play data
	* @param data play data to convert from
	* @param hasIntensity wether the pattern uses intensity
	* @param canInvert wether the pattern can be inverted
	* @returns a PatternHelper instance
	*/
	static fromPlayData(data, hasIntensity = false, canInvert = false) {
		const maxDepth = data.depth;
		const minDepth = data.depth - data.stroke;
		let intensity = void 0;
		let invert = void 0;
		if (canInvert) {
			intensity = Math.abs((data.sensation - 50) * 2);
			invert = data.sensation < 50;
		} else if (hasIntensity) intensity = data.sensation;
		return new PatternHelper(data.pattern, minDepth, maxDepth, data.speed, intensity, invert);
	}
};
let KnownPattern = /* @__PURE__ */ function(KnownPattern$1) {
	/**
	* Acceleration, coasting, deceleration equally split
	* @param hasIntensity `false`
	* @param canInvert `false`
	* @example
	* ```ts
	* // Set a simple stroke from 20% to 80% depth at 70% speed
	* await ossmBle.runStrokeEnginePattern(new PatternHelper(KnownPattern.SimpleStroke, 20, 80, 70));
	* ```
	*/
	KnownPattern$1[KnownPattern$1["SimpleStroke"] = 0] = "SimpleStroke";
	/**
	* A rhythmic back-and-forth motion with asymmetric timing. The actuator moves steadily in one direction and quickly in the other
	* @param intensity how pronounced the teasing/pounding effect is
	* @param invert when `true`, the actuator retracts quickly and extends slowly; when `false`, it extends quickly and retracts slowly
	*/
	KnownPattern$1[KnownPattern$1["TeasingPounding"] = 1] = "TeasingPounding";
	/**
	* Full and half depth strokes alternate
	* @param intensity how pronounced the half/full depth effect is, lower is more robotic, higher is smoother
	* @param canInvert `false`
	*/
	KnownPattern$1[KnownPattern$1["RoboStroke"] = 2] = "RoboStroke";
	/**
	* Full and half depth strokes alternate
	* @param intensity how pronounced the half/full depth effect is
	* @param invert when `true`, the pattern starts with a half-depth stroke; when `false`, it starts with a full-depth stroke
	*/
	KnownPattern$1[KnownPattern$1["HalfNHalf"] = 3] = "HalfNHalf";
	/**
	* Gradually deepens the stroke over a set number of cycles
	* @param intensity multiplier for how many cycles occur before resetting
	* @param canInvert `false`
	*/
	KnownPattern$1[KnownPattern$1["Deeper"] = 4] = "Deeper";
	/**
	* Pauses between strokes
	* @param intensity pause duration multiplier
	* @param canInvert `false`
	*/
	KnownPattern$1[KnownPattern$1["StopNGo"] = 5] = "StopNGo";
	/**
	* Modifies length, maintains speed; sensation influences direction
	* //TODO: Clarify this description
	* @note Can be used to set the rod to a specific position
	* @example
	* ```ts
	* await ossmBle.runStrokeEnginePattern({
	*    pattern: KnownPattern.Insist,
	*    depth: 30,
	*    speed: 50,
	*    stroke: 100,
	*    sensation: 100
	* });
	* ```
	*/
	KnownPattern$1[KnownPattern$1["Insist"] = 6] = "Insist";
	return KnownPattern$1;
}({});

//#endregion
//#region src/ossmBle.ts
const OSSM_DEVICE_NAME = "OSSM";
const BASE_COMMAND_PROCESS_DELAY_MS = 50;
const DISCONNECT_TIMEOUT_MS = 5e3;
const OSSM_GATT_SERVICES = { PRIMARY: {
	uuid: "522b443a-4f53-534d-0001-420badbabe69",
	characteristics: {
		COMMAND: "522b443a-4f53-534d-1000-420badbabe69",
		SPEED_KNOB_CONFIGURATION: "522b443a-4f53-534d-1010-420badbabe69",
		CURRENT_STATE: "522b443a-4f53-534d-2000-420badbabe69",
		PATTERN_LIST: "522b443a-4f53-534d-3000-420badbabe69",
		PATTERN_DESCRIPTION: "522b443a-4f53-534d-3010-420badbabe69"
	}
} };
const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();
var OssmBle = class OssmBle {
	/**
	* Checks if the current browser supports all the required Web APIs for this library
	* @returns `true` if supported, `false` otherwise
	*/
	static isClientSupported() {
		return !(!navigator.bluetooth || !navigator.bluetooth.requestDevice);
	}
	/**
	* Prompts the user via the browser to pair with an OSSM BLE device
	* @requires that the page is served over HTTPS or from localhost & is called by a user gesture
	* @returns BluetoothDevice on successful pairing
	* @throws DOMException if pairing is cancelled or fails
	*/
	static async pairDevice() {
		return new OssmBle(await navigator.bluetooth.requestDevice({
			filters: [{ name: OSSM_DEVICE_NAME }],
			optionalServices: [OSSM_GATT_SERVICES.PRIMARY.uuid]
		}));
	}
	device;
	bleTaskQueue = new AsyncFunctionQueue();
	eventCallbacks = /* @__PURE__ */ new Map();
	autoReconnect = true;
	isReady = false;
	ossmServices = null;
	lastPoll = 0;
	cachedState = null;
	cachedPatternList = null;
	lastFixedPosition = null;
	commandProcessDelayMs = BASE_COMMAND_PROCESS_DELAY_MS;
	constructor(device) {
		this.device = device;
		if (!device.gatt) throw new DOMException("Device is not connectable via GATT.", "NotSupportedError");
		this.device.addEventListener("gattserverdisconnected", this.onDisconnected.bind(this));
	}
	[Symbol.dispose]() {
		this.end();
	}
	async dispatchEvent(data) {
		const callbacks = this.eventCallbacks.get(data.event);
		if (callbacks) for (const callback of callbacks) callback(data);
	}
	async connect() {
		if (this.device.gatt?.connected) return;
		this.bleTaskQueue.clearQueue();
		await this.bleTaskQueue.enqueue(async () => {
			const gattSnapshot = await this.device.gatt.connect();
			await delay(100);
			this.ossmServices = {};
			for (const svcKey in OSSM_GATT_SERVICES) {
				const svc = OSSM_GATT_SERVICES[svcKey];
				const service = await gattSnapshot.getPrimaryService(svc.uuid);
				const characteristics = {};
				for (const charKey in svc.characteristics) {
					const charUuid = svc.characteristics[charKey];
					characteristics[upperSnakeToCamel(charKey)] = await service.getCharacteristic(charUuid);
				}
				this.ossmServices[upperSnakeToCamel(svcKey)] = {
					service,
					characteristics
				};
			}
			this.ossmServices.primary.characteristics.currentState.addEventListener("characteristicvaluechanged", this.onCurrentStateChanged.bind(this));
			await this.ossmServices.primary.characteristics.currentState.startNotifications();
		});
		this.debugLog("Connected");
		this.isReady = true;
		this.dispatchEvent({ event: OssmEventType.Connected });
	}
	throwIfNotReady() {
		if (!this.isReady) throw new DOMException("ossmBle not ready", DOMExceptionError.InvalidState);
	}
	async onDisconnected() {
		this.isReady = false;
		this.debugLog("Disconnected");
		this.dispatchEvent({ event: OssmEventType.Disconnected });
		this.debugLogIf(this.autoReconnect, "Reconnecting...");
		let i = 0;
		while (this.autoReconnect) try {
			const lastPollCaptured = this.lastPoll;
			await this.connect();
			if (lastPollCaptured + DISCONNECT_TIMEOUT_MS < Date.now()) {
				this.debugLog("Disconnected for too long; stopping OSSM for safety.");
				try {
					await this.stop();
				} catch {}
			}
			break;
		} catch (error) {
			this.debugLog(`Reconnection attempt ${i} failed:`, error);
			await new Promise((resolve) => setTimeout(resolve, 250));
			i++;
		}
	}
	onCurrentStateChanged(event) {
		this.lastPoll = Date.now();
		const oldState = this.cachedState;
		const { state, ...rest } = JSON.parse(TEXT_DECODER.decode(event.target.value));
		const remappedStateObj = {
			status: state,
			...rest
		};
		if (oldState && JSON.stringify(oldState) === JSON.stringify(remappedStateObj)) return;
		this.cachedState = remappedStateObj;
		this.debugLogTable({
			"New state": remappedStateObj,
			"Old state": this.cachedState
		});
		this.dispatchEvent({
			event: OssmEventType.StateChanged,
			[OssmEventType.StateChanged]: {
				newState: remappedStateObj,
				oldState
			}
		});
	}
	async sendCommand(value) {
		this.throwIfNotReady();
		const returnedValue = await this.bleTaskQueue.enqueue(async () => {
			await this.ossmServices.primary.characteristics.command.writeValue(TEXT_ENCODER.encode(value));
			await delay(this.commandProcessDelayMs);
			return TEXT_DECODER.decode((await this.ossmServices.primary.characteristics.command.readValue()).buffer);
		});
		if (returnedValue === `fail:${value}`) throw new DOMException(`OSSM failed to process command: ${value}`, DOMExceptionError.OperationError);
		else if (returnedValue !== `${value}`) throw new DOMException(`OSSM returned unexpected response for command "${value}": ${returnedValue}`, DOMExceptionError.DataError);
	}
	/**
	* Begins automatic connection management.
	* A call to {@link waitForReady()} is recommended after this to ensure the library is ready before sending commands
	*/
	begin() {
		this.autoReconnect = true;
		try {
			this.connect();
		} catch (error) {}
	}
	/**
	* Ends automatic connection management and disconnects from the device
	*/
	end() {
		this.autoReconnect = false;
		this.bleTaskQueue.clearQueue();
		const doDisconnect = () => {
			if (this.device.gatt?.connected) this.device.gatt.disconnect();
		};
		if (this.isReady) this.stop().finally(doDisconnect);
		else doDisconnect();
	}
	/**
	* Checks whether automatic reconnection will occur upon disconnection
	* @returns `true` if auto-reconnect is enabled, `false` otherwise
	*/
	willAutoReconnect() {
		return this.autoReconnect;
	}
	/**
	* Adds an event listener for the specified event type
	* @param eventType one of {@link OssmEventType}
	* @param callback Function to call when the event occurs (see {@link OssmEventCallback})
	*/
	addEventListener(eventType, callback) {
		if (!this.eventCallbacks.has(eventType)) this.eventCallbacks.set(eventType, []);
		this.eventCallbacks.get(eventType).push(callback);
	}
	/**
	* Removes an event listener for the specified event type
	* @param eventType one of {@link OssmEventType}
	* @param callback Function to remove
	*/
	removeEventListener(eventType, callback) {
		if (!this.eventCallbacks.has(eventType)) return;
		const callbacks = this.eventCallbacks.get(eventType);
		const index = callbacks.indexOf(callback);
		if (index !== -1) callbacks.splice(index, 1);
	}
	/**
	* Set stroke speed percentage
	* @param speed A {@link number} between 0 and 100
	* @throws RangeError if speed is out of range
	* @throws DOMException if the command fails
	*/
	async setSpeed(speed) {
		if (speed < 0 || speed > 100 || !Number.isInteger(speed)) throw new RangeError("Speed must be an integer between 0 and 100.");
		if (this.cachedState?.speed === speed) return;
		await this.sendCommand(`set:speed:${speed}`);
	}
	/**
	* Set stroke length percentage
	* @param stroke A {@link number} between 0 and 100
	* @throws RangeError if stroke is out of range
	* @throws DOMException if the command fails
	*/
	async setStroke(stroke) {
		if (stroke < 0 || stroke > 100 || !Number.isInteger(stroke)) throw new RangeError("Stroke must be an integer between 0 and 100.");
		if (this.cachedState?.stroke === stroke) return;
		if (stroke > 0 && stroke < 100) stroke -= 1;
		await this.sendCommand(`set:stroke:${stroke}`);
	}
	/**
	* Set penetration depth percentage
	* @param depth A {@link number} between 0 and 100
	* @throws RangeError if depth is out of range
	* @throws DOMException if the command fails
	*/
	async setDepth(depth) {
		if (depth < 0 || depth > 100 || !Number.isInteger(depth)) throw new RangeError("Depth must be an integer between 0 and 100.");
		if (this.cachedState?.depth === depth) return;
		if (depth > 0 && depth < 100) depth -= 1;
		await this.sendCommand(`set:depth:${depth}`);
	}
	/**
	* Set sensation intensity percentage
	* @param sensation A {@link number} between 0 and 100
	* @throws RangeError if sensation is out of range
	* @throws DOMException if the command fails
	*/
	async setSensation(sensation) {
		if (sensation < 0 || sensation > 100 || !Number.isInteger(sensation)) throw new RangeError("Sensation must be an integer between 0 and 100.");
		if (this.cachedState?.sensation === sensation) return;
		if (sensation > 0 && sensation < 100) sensation -= 1;
		await this.sendCommand(`set:sensation:${sensation}`);
	}
	/**
	* Set stroke pattern (see {@link getPatternList} for available patterns)
	* @param patternId A {@link number} corresponding to a pattern ID (see {@link KnownPattern})
	* @throws RangeError if patternId is negative or not within the range of patterns (see {@link getPatternList()})
	*/
	async setPattern(patternId) {
		if (patternId < 0 || !Number.isInteger(patternId)) throw new RangeError("Pattern ID must be a non-negative integer.");
		if (this.cachedPatternList === null) await this.getPatternList();
		if (this.cachedPatternList && !this.cachedPatternList.find((p) => p.idx === patternId)) throw new RangeError(`Pattern ID ${patternId} is not in the available pattern list.`);
		await this.sendCommand(`set:pattern:${patternId}`);
	}
	/**
	* Navigate to a specific menu page
	* @param page One of the {@link OssmPage} enum values
	*/
	async navigateTo(page) {
		let currentPage = this.getCurrentPage();
		if (currentPage === page) return;
		if (OSSM_PAGE_NAVIGATION_GRAPH[currentPage].includes(page)) {
			await this.sendCommand(`go:${page}`);
			return;
		}
		const visited = new Set([currentPage]);
		const queue = [[currentPage]];
		while (queue.length) {
			const path = queue.shift();
			const node = path[path.length - 1];
			for (const next of OSSM_PAGE_NAVIGATION_GRAPH[node]) {
				if (visited.has(next)) continue;
				const newPath = [...path, next];
				if (next === page) {
					for (let i = 1; i < newPath.length; i++) await this.sendCommand(`go:${newPath[i]}`);
					return;
				}
				visited.add(next);
				queue.push(newPath);
			}
		}
		throw new DOMException(`Cannot navigate to page ${page} from current page ${currentPage}.`, DOMExceptionError.InvalidState);
	}
	/**
	* Configure whether speed knob acts as upper limit for BLE speed commands
	* @param knobAsLimit
	* **When** `true`: BLE speed commands (0-100) are treated as a percentage of the current physical knob value  
	* Example: Knob at 50%, BLE command `set:speed:80` → Effective speed = 40%  
	* **When** `false`: BLE speed commands (0-100) are used directly as the speed value  
	* Example: BLE command `set:speed:80` → Effective speed = 80%
	*/
	async setSpeedKnobConfig(knobAsLimit) {
		this.throwIfNotReady();
		await this.ossmServices.primary.characteristics.speedKnobConfiguration.writeValue(TEXT_ENCODER.encode(knobAsLimit ? "true" : "false"));
		await delay(this.commandProcessDelayMs);
		if (await this.getSpeedKnobConfig() !== knobAsLimit) throw new DOMException("Failed to set speed knob configuration.", DOMExceptionError.DataError);
	}
	/**
	* Gets whether speed knob acts as upper limit for BLE speed commands
	* @returns `true` if speed knob is configured as upper limit, `false` otherwise
	*/
	async getSpeedKnobConfig() {
		this.throwIfNotReady();
		return TEXT_DECODER.decode((await this.ossmServices.primary.characteristics.speedKnobConfiguration.readValue()).buffer) === "true";
	}
	/**
	* Gets the list of available stroke patterns from the OSSM device
	* @returns An array of {@link OssmPattern} objects
	*/
	async getPatternList() {
		this.throwIfNotReady();
		const patternList = await this.bleTaskQueue.enqueue(async () => JSON.parse(TEXT_DECODER.decode((await this.ossmServices.primary.characteristics.patternList.readValue()).buffer)));
		let patterns = [];
		for (const rawPattern of patternList) {
			const description = await this.bleTaskQueue.enqueue(async () => {
				await this.ossmServices.primary.characteristics.patternDescription.writeValue(TEXT_ENCODER.encode(`${rawPattern.idx}`));
				await delay(this.commandProcessDelayMs);
				return TEXT_DECODER.decode((await this.ossmServices.primary.characteristics.patternDescription.readValue()).buffer);
			});
			if (!description) throw new DOMException(`Failed to get description for pattern ID ${rawPattern.idx}`, DOMExceptionError.DataError);
			patterns.push({
				name: rawPattern.name,
				idx: rawPattern.idx,
				description
			});
		}
		this.debugLog("Fetched pattern list:");
		this.debugLogTable(patterns);
		this.cachedPatternList = patterns;
		return patterns;
	}
	/**
	* Emergency stops the OSSM device  
	* @remarks This should not be used to stop normal operations, use {@link setSpeed(setSpeed(0))} instead
	*/
	async stop() {
		if (!this.isReady) return;
		this.bleTaskQueue.clearQueue();
		await this.bleTaskQueue.enqueue(async () => {
			await this.ossmServices.primary.characteristics.command.writeValue(TEXT_ENCODER.encode("set:speed:0"));
		});
	}
	/**
	* Gets whether the OSSM device is ready
	* @returns `true` if ready, `false` if not ready
	*/
	getIsReady() {
		return this.isReady;
	}
	/**
	* Waits until the OssmBle instance is ready for commands
	* @param timeout Maximum time to wait in milliseconds. Defaults to infinity.
	*/
	async waitForReady(timeout = Number.POSITIVE_INFINITY) {
		const startTime = Date.now();
		while (!this.isReady) {
			if (Date.now() - startTime > timeout) throw new DOMException("Timeout waiting for ossmBle to be ready.", DOMExceptionError.Timeout);
			await delay(100);
		}
	}
	/**
	* Gets the OSSM state
	* @param timeout Maximum time to wait for a state update in milliseconds. Defaults to infinity.
	*/
	async getState(timeout = Number.POSITIVE_INFINITY) {
		const startTime = Date.now();
		while (!this.isReady || !this.cachedState) {
			if (Date.now() - startTime > timeout) throw new DOMException("Timeout waiting for OSSM state.", DOMExceptionError.Timeout);
			await delay(100);
		}
		return this.cachedState;
	}
	/**
	* Gets the last cached pattern list
	* @returns An array of {@link OssmPattern} objects or `null` if no pattern list has been cached yet
	*/
	getCachedPatternList() {
		return this.cachedPatternList;
	}
	/**
	* Gets the current OSSM page
	* @param state Optional {@link OssmState} object to use instead of the cached state
	* @returns One of the {@link OssmPage} enum values
	* @throws DOMException if no state is available or the state is invalid (e.g. busy doing homing task)
	*/
	getCurrentPage(state = null) {
		if (!state) state = this.cachedState;
		if (!state) throw new DOMException("No state available to determine current page.", DOMExceptionError.InvalidState);
		const currentPage = state.status.indexOf(".") !== -1 ? state.status.split(".")[0] : state.status;
		if (!Object.values(OssmPage).includes(currentPage)) throw new DOMException(`Unknown OSSM page: ${currentPage}`, DOMExceptionError.DataError);
		return currentPage;
	}
	/**
	* Waits until the OSSM device reaches the specified status
	* @param status The desired {@link OssmStatus}
	* @param timeout Maximum time to wait in milliseconds. Defaults to infinity.
	* @throws DOMException if timeout is reached before the status is achieved
	*/
	async waitForStatus(status, timeout = Number.POSITIVE_INFINITY) {
		const startTime = Date.now();
		while (true) {
			const currentState = await this.getState(timeout);
			if (currentState && (Array.isArray(status) ? status.includes(currentState.status) : currentState.status === status)) return;
			if (Date.now() - startTime > timeout) throw new DOMException(`Timeout waiting for OSSM to reach status ${status}.`, DOMExceptionError.Timeout);
			await delay(100);
		}
	}
	/**
	* Apply & run a stroke engine pattern by setting speed, stroke, depth, sensation, and pattern in an order designed to reduce jerkiness
	* @param data An {@link OssmPlayData} object containing the desired settings
	* @requires being on the Stroke Engine page
	*/
	async runStrokeEnginePattern(data) {
		const min = data.depth - data.stroke;
		const capturedState = await this.getState();
		const currentPage = this.getCurrentPage(capturedState);
		const currentPattern = capturedState.pattern;
		const oldDepth = capturedState.depth;
		const oldMin = oldDepth - capturedState.stroke;
		const oldMax = oldDepth;
		const oldSpeed = capturedState.speed;
		if (currentPage !== OssmPage.StrokeEngine) throw new DOMException("Must be on Stroke Engine page to set simple stroke.", DOMExceptionError.InvalidState);
		if (currentPattern !== data.pattern) await this.setPattern(data.pattern);
		if (data.speed < oldSpeed) {
			this.debugLog("strokeEngineSetSimpleStroke:", "Safe case: Decreasing speed");
			await this.setSpeed(data.speed);
			await this.setDepth(data.depth);
			await this.setStroke(data.stroke);
			await this.setSensation(data.sensation);
		} else if (data.speed > oldSpeed && (min < oldMin || data.depth > oldMax)) {
			this.debugLog("strokeEngineSetSimpleStroke:", "Risky case: Increasing speed with extended range");
			await this.setDepth(data.depth);
			await this.setStroke(data.stroke);
			await this.setSpeed(data.speed);
			await this.setSensation(data.sensation);
		} else {
			this.debugLog("strokeEngineSetSimpleStroke:", "Neutral case");
			await this.setDepth(data.depth);
			await this.setStroke(data.stroke);
			await this.setSpeed(data.speed);
			await this.setSensation(data.sensation);
		}
	}
	/**
	* Moves the rod to a specific position percentage
	* @param position A {@link number} between 0 and 100
	* @throws RangeError if position is out of range
	* @requires being on the Stroke Engine page
	*/
	async moveToPosition(position, speed) {
		const currentState = await this.getState();
		if (this.getCurrentPage(currentState) !== OssmPage.StrokeEngine) throw new DOMException("Must be on Stroke Engine page to set simple stroke.", DOMExceptionError.InvalidState);
		if (currentState.pattern !== KnownPattern.Insist || currentState.sensation !== 100 || currentState.stroke !== 100) {
			this.debugLog("setPosition:", "Not pre-configured (slowest)");
			await this.setSpeed(0);
			await this.setPattern(KnownPattern.Insist);
			await this.setSensation(100);
			await this.setStroke(100);
			await this.setDepth(position);
			await this.setSpeed(speed);
		} else if (this.lastFixedPosition === currentState.depth) {
			this.debugLog("setPosition:", "Pre-configured (faster)");
			await this.setSpeed(speed);
			await this.setDepth(position);
		} else {
			this.debugLog("setPosition:", "Pre-configured (slower)");
			await this.setSpeed(0);
			await this.setDepth(position);
			await this.setSpeed(speed);
		}
		this.lastFixedPosition = position;
	}
	debug = false;
	debugLog(...args) {
		if (this.debug) console.log(`[OssmBle ${this.device.id}]`, ...args);
	}
	debugLogIf(condition, ...args) {
		if (condition) this.debugLog(...args);
	}
	debugLogTable(table) {
		if (this.debug) console.table(table);
	}
	debugLogTableIf(condition, table) {
		if (condition) this.debugLogTable(table);
	}
};

//#endregion
export { KnownPattern, OssmBle, OssmEventType, OssmPage, OssmStatus, PatternHelper, mapRational };