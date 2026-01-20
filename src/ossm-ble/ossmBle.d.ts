//#region src/ossmBleTypes.d.ts
declare enum OssmEventType {
  /** Emitted when the device is successfully connected */
  Connected = 0,
  /** Emitted when the device is disconnected */
  Disconnected = 1,
  /**
  * Emitted when the device state changes  
  * 
  * Notification Behavior:
  * - State changes trigger immediate notifications
  * - Periodic notifications every 1000ms if no state change
  * - Notifications stop when no clients connected
  */
  StateChanged = 2,
}
type OssmEventCallbackParameters = {
  event: OssmEventType;
  [OssmEventType.StateChanged]?: {
    newState: OssmState;
  };
};
type OssmEventCallback = (data: OssmEventCallbackParameters) => Promise<any> | any;
declare enum OssmStatus {
  /** Initializing */
  Idle = "idle",
  /** Homing sequence active */
  Homing = "homing",
  /** Forward homing in progress */
  HomingForward = "homing.forward",
  /** Backward homing in progress */
  HomingBackward = "homing.backward",
  /** Main menu displayed */
  Menu = "menu",
  /** Menu idle state */
  MenuIdle = "menu.idle",
  /** Simple penetration mode */
  SimplePenetration = "simplePenetration",
  /** Simple penetration idle */
  SimplePenetrationIdle = "simplePenetration.idle",
  /** Pre-flight checks */
  SimplePenetrationPreflight = "simplePenetration.preflight",
  /** Stroke engine mode */
  StrokeEngine = "strokeEngine",
  /** Stroke engine idle */
  StrokeEngineIdle = "strokeEngine.idle",
  /** Pre-flight checks */
  StrokeEnginePreflight = "strokeEngine.preflight",
  /** Pattern selection */
  StrokeEnginePattern = "strokeEngine.pattern",
  /** Update mode */
  Update = "update",
  /** Checking for updates */
  UpdateChecking = "update.checking",
  /** Update in progress */
  UpdateUpdating = "update.updating",
  /** Update idle */
  UpdateIdle = "update.idle",
  /** WiFi setup mode */
  Wifi = "wifi",
  /** WiFi setup idle */
  WifiIdle = "wifi.idle",
  /** Help screen */
  Help = "help",
  /** Help idle */
  HelpIdle = "help.idle",
  /** Error state */
  Error = "error",
  /** Error idle */
  ErrorIdle = "error.idle",
  /** Error help */
  ErrorHelp = "error.help",
  /** Restart state */
  Restart = "restart",
}
interface OssmPlayData {
  speed: number;
  stroke: number;
  sensation: number;
  depth: number;
  pattern: number;
}
interface OssmState extends OssmPlayData {
  status: OssmStatus;
}
declare enum OssmPage {
  /** Switch to simple penetration mode */
  SimplePenetration = "simplePenetration",
  /** Switch to stroke engine mode */
  StrokeEngine = "strokeEngine",
  /** Return to main menu */
  Menu = "menu",
}
interface OssmPattern {
  name: string;
  idx: number;
  description: string;
}
//#endregion
//#region src/patterns.d.ts
declare class PatternHelper implements OssmPlayData {
  /** The pattern identifier */
  readonly patternId: number;
  /** The minimum depth percentage (0-100) */
  readonly minDepth: number;
  /** The maximum depth percentage (0-100) */
  readonly maxDepth: number;
  /** How pronounced the effect is (0-100) */
  readonly intensity: number | undefined;
  /** When `true`, the pattern direction is reversed; default is `false` */
  readonly invert: boolean | undefined;
  readonly speed: number;
  readonly pattern: number;
  readonly stroke: number;
  readonly depth: number;
  readonly sensation: number;
  constructor(patternId: number, minDepth: number, maxDepth: number, speed: number, intensity?: number | undefined, invert?: boolean | undefined);
  /**
  * Creates a PatternHelper from raw play data
  * @param data play data to convert from
  * @param hasIntensity wether the pattern uses intensity
  * @param canInvert wether the pattern can be inverted
  * @returns a PatternHelper instance
  */
  static fromPlayData(data: OssmPlayData, hasIntensity?: boolean, canInvert?: boolean): PatternHelper;
}
declare enum KnownPattern {
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
  SimpleStroke = 0,
  /**
  * A rhythmic back-and-forth motion with asymmetric timing. The actuator moves steadily in one direction and quickly in the other
  * @param intensity how pronounced the teasing/pounding effect is
  * @param invert when `true`, the actuator retracts quickly and extends slowly; when `false`, it extends quickly and retracts slowly
  */
  TeasingPounding = 1,
  /**
  * Robotic-style strokes with abrupt starts and stops
  * @param intensity how pronounced the effect is, lower is more robotic, higher is smoother
  * @param canInvert `false`
  */
  RoboStroke = 2,
  /**
  * Full and half depth strokes alternate
  * @param intensity how pronounced the half/full depth effect is
  * @param invert when `true`, the pattern starts with a half-depth stroke; when `false`, it starts with a full-depth stroke
  */
  HalfNHalf = 3,
  /**
  * Gradually deepens the stroke over a set number of cycles
  * @param intensity multiplier for how many cycles occur before resetting
  * @param canInvert `false`
  */
  Deeper = 4,
  /**
  * Pauses between strokes
  * @param intensity pause duration multiplier
  * @param canInvert `false`
  */
  StopNGo = 5,
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
  Insist = 6,
}
//#endregion
//#region src/helpers.d.ts

/** Useful for modifying the speed value for OSSM since it seems to be non-linear */
declare function mapRational(x: number, k?: number): number;
//#endregion
//#region src/ossmBle.d.ts
declare class OssmBle implements Disposable {
  /**
  * Checks if the current browser supports all the required Web APIs for this library
  * @returns `true` if supported, `false` otherwise
  */
  static isClientSupported(): boolean;
  /**
  * Prompts the user via the browser to pair with an OSSM BLE device
  * @requires that the page is served over HTTPS or from localhost & is called by a user gesture
  * @returns BluetoothDevice on successful pairing
  * @throws DOMException if pairing is cancelled or fails
  */
  static pairDevice(): Promise<OssmBle>;
  private readonly device;
  private readonly bleTaskQueue;
  private readonly eventCallbacks;
  private autoReconnect;
  private isReady;
  private ossmServices;
  private lastPoll;
  private cachedState;
  private pendingStateTarget;
  private cachedPatternList;
  private lastFixedPosition;
  commandProcessDelayMs: number;
  private constructor();
  [Symbol.dispose](): void;
  private dispatchEvent;
  private connect;
  private throwIfNotReady;
  private onDisconnected;
  private isIntermediateValue;
  private waitForPendingTargetsToSettle;
  private onCurrentStateChanged;
  /**
  * Begins automatic connection management.
  * A call to {@link waitForReady()} is recommended after this to ensure the library is ready before sending commands
  */
  begin(): void;
  /**
  * Ends automatic connection management and disconnects from the device
  */
  end(): void;
  /**
  * Send a raw command to the OSSM device
  * @param value The command string to send
  * @param speedup When `true`, the command is sent without waiting for and validating the response
  */
  sendCommand(value: string, speedup?: boolean): Promise<void>;
  /**
  * Checks whether automatic reconnection will occur upon disconnection
  * @returns `true` if auto-reconnect is enabled, `false` otherwise
  */
  willAutoReconnect(): boolean;
  /**
  * Adds an event listener for the specified event type
  * @param eventType one of {@link OssmEventType}
  * @param callback Function to call when the event occurs (see {@link OssmEventCallback})
  */
  addEventListener(eventType: OssmEventType, callback: OssmEventCallback): void;
  /**
  * Removes an event listener for the specified event type
  * @param eventType one of {@link OssmEventType}
  * @param callback Function to remove
  */
  removeEventListener(eventType: OssmEventType, callback: OssmEventCallback): void;
  /**
  * Set stroke speed percentage
  * @param speed A {@link number} between 0 and 100
  * @throws RangeError if speed is out of range
  * @throws DOMException if the command fails
  */
  setSpeed(speed: number): Promise<void>;
  /**
  * Set stroke length percentage
  * @param stroke A {@link number} between 0 and 100
  * @throws RangeError if stroke is out of range
  * @throws DOMException if the command fails
  */
  setStroke(stroke: number): Promise<void>;
  /**
  * Set penetration depth percentage
  * @param depth A {@link number} between 0 and 100
  * @throws RangeError if depth is out of range
  * @throws DOMException if the command fails
  */
  setDepth(depth: number): Promise<void>;
  /**
  * Set sensation intensity percentage
  * @param sensation A {@link number} between 0 and 100
  * @throws RangeError if sensation is out of range
  * @throws DOMException if the command fails
  */
  setSensation(sensation: number): Promise<void>;
  /**
  * Set stroke pattern (see {@link getPatternList} for available patterns)
  * @param patternId A {@link number} corresponding to a pattern ID (see {@link KnownPattern})
  * @throws RangeError if patternId is negative or not within the range of patterns (see {@link getPatternList()})
  */
  setPattern(patternId: number): Promise<void>;
  /**
  * Navigate to a specific menu page
  * @param page One of the {@link OssmPage} enum values
  */
  navigateTo(page: OssmPage): Promise<void>;
  /**
  * Configure whether speed knob acts as upper limit for BLE speed commands
  * @param knobAsLimit
  * **When** `true`: BLE speed commands (0-100) are treated as a percentage of the current physical knob value  
  * Example: Knob at 50%, BLE command `set:speed:80` → Effective speed = 40%  
  * **When** `false`: BLE speed commands (0-100) are used directly as the speed value  
  * Example: BLE command `set:speed:80` → Effective speed = 80%
  */
  setSpeedKnobConfig(knobAsLimit: boolean): Promise<void>;
  /**
  * Gets whether speed knob acts as upper limit for BLE speed commands
  * @returns `true` if speed knob is configured as upper limit, `false` otherwise
  */
  getSpeedKnobConfig(): Promise<boolean>;
  /**
  * Gets the list of available stroke patterns from the OSSM device
  * @returns An array of {@link OssmPattern} objects
  */
  getPatternList(): Promise<OssmPattern[]>;
  /**
  * Emergency stops the OSSM device  
  * @remarks This should not be used to stop normal operations, use {@link setSpeed(setSpeed(0))} instead
  */
  stop(): Promise<void>;
  /**
  * Gets whether the OSSM device is ready
  * @returns `true` if ready, `false` if not ready
  */
  getIsReady(): boolean;
  /**
  * Waits until the OssmBle instance is ready for commands
  * @param timeout Maximum time to wait in milliseconds. Defaults to infinity.
  */
  waitForReady(timeout?: number): Promise<void>;
  /**
  * Gets the OSSM state
  * @param timeout Maximum time to wait for a state update in milliseconds. Defaults to infinity.
  */
  getState(timeout?: number): Promise<OssmState>;
  /**
  * Gets the last cached pattern list
  * @returns An array of {@link OssmPattern} objects or `null` if no pattern list has been cached yet
  */
  getCachedPatternList(): OssmPattern[] | null;
  /**
  * Gets the current OSSM page
  * @param state Optional {@link OssmState} object to use instead of the cached state
  * @returns One of the {@link OssmPage} enum values
  * @throws DOMException if no state is available or the state is invalid (e.g. busy doing homing task)
  */
  getCurrentPage(state?: OssmState | null): OssmPage;
  /**
  * Waits until the OSSM device reaches the specified status
  * @param status The desired {@link OssmStatus}
  * @param timeout Maximum time to wait in milliseconds. Defaults to infinity.
  * @throws DOMException if timeout is reached before the status is achieved
  */
  waitForStatus(status: OssmStatus | OssmStatus[], timeout?: number): Promise<void>;
  /**
  * Apply & run a stroke engine pattern by setting speed, stroke, depth, sensation, and pattern in an order designed to reduce jerkiness
  * @param data An {@link OssmPlayData} object containing the desired settings
  * @requires being on the Stroke Engine page
  */
  runStrokeEnginePattern(data: OssmPlayData): Promise<void>;
  /**
  * Moves the rod to a specific position percentage
  * @param position A {@link number} between 0 and 100
  * @throws RangeError if position is out of range
  * @requires being on the Stroke Engine page
  */
  moveToPosition(position: number, speed: number): Promise<void>;
  /**
  * Batch set multiple OssmPlayData settings in one go.  
  * *Note:* It is advised you use runStrokeEnginePattern where possible instead of this method to apply settings in a safe order.
  * @param data An array of tuples containing the key and value to set
  * @throws Error if the same key is set multiple times in the batch
  */
  batchSet(data: Array<[keyof OssmPlayData, number]>): Promise<void>;
  debug: boolean;
  private debugLog;
  private debugLogIf;
  private debugLogTable;
  private debugLogTableIf;
}
//#endregion
export { KnownPattern, OssmBle, type OssmEventCallback, type OssmEventCallbackParameters, OssmEventType, OssmPage, type OssmPattern, type OssmState, OssmStatus, PatternHelper, mapRational };