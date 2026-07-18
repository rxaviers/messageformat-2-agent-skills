# gpt-5.6-terra Medium Evaluation Run

This exploratory run captured one clean paired response for every eval in both skills. The target skills were disabled from automatic discovery in both conditions; the with-skill arm loaded the repository skill explicitly, while the baseline did not.

Raw outputs are stored under each skill's `trial-01/` directory. Assertion grading and aggregate statistics remain pending because the run exposed an evaluator reliability issue: one early baseline call stalled and was retried with web search disabled. The retry is the stored baseline output.

Do not compare this run's timing or token use with the earlier run: per-run telemetry was not captured consistently enough for a fair aggregate.
