import clsx from 'clsx';
import { stepItems } from '../../lib/workflow';
import type { WorkflowStep } from '../../types/ocr';

type StepperProps = {
  currentStep: WorkflowStep;
};

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="glass-card p-4 sm:p-5">
      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between">
        {stepItems.map((step, index) => (
          <div key={step.id} className="flex flex-1 items-center">
            {/* Circle + Text */}
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition',
                  currentStep >= step.id
                    ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-400 dark:bg-blue-500'
                    : 'border-blue-200 bg-white text-slate-500 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                {step.id}
              </div>
              <p
                className={clsx(
                  'text-sm',
                  currentStep >= step.id
                    ? 'font-semibold text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-300'
                )}
              >
                {step.title}
              </p>
            </div>

            {/* Line */}
            {index < stepItems.length - 1 && (
              <div className="flex-1 mx-4 h-px bg-blue-200 dark:bg-blue-900" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {stepItems.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
                currentStep >= step.id
                  ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-400 dark:bg-blue-500'
                  : 'border-blue-200 bg-white text-slate-500 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {step.id}
            </div>
            <p
              className={clsx(
                'text-sm',
                currentStep === step.id
                  ? 'font-semibold text-slate-900 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-300'
              )}
            >
              {step.title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}