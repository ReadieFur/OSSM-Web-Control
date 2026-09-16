export type ActiveView = 'landing' | 'control';

export class ViewManager {
    public currentView = $state<ActiveView>('landing');
}
