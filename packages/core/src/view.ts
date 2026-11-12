/**
 * How much of a run the job summary and the log show. Each view adds to the one before it:
 * `compact` is the verdict, `standard` adds the failing test cases, `detailed` spells out each failure
 * and breaks the run down by suite, `full` lists every test case. JUnit and JSON always carry everything.
 */
export type View = 'compact' | 'standard' | 'detailed' | 'full';

export const VIEW_VALUES: readonly View[] = ['compact', 'standard', 'detailed', 'full'];

export const DEFAULT_VIEW: View = 'standard';

/** The view to render; a value no view has (from a JavaScript caller) gets the default. */
export function viewOrDefault(view: string): View {
  return (VIEW_VALUES as readonly string[]).includes(view) ? (view as View) : DEFAULT_VIEW;
}
