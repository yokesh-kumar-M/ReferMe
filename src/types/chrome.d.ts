// Chrome Extension API type declarations
// These are minimal declarations to support the Chrome Extension build mode.
// In production, the actual Chrome Extension APIs are available at runtime.

declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }
    function query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Tab[]>;
  }
  
  namespace scripting {
    interface InjectionResult<T = unknown> {
      result: T;
    }
    function executeScript<T>(injection: {
      target: { tabId: number };
      func: () => T;
    }): Promise<InjectionResult<T>[]>;
  }
}
