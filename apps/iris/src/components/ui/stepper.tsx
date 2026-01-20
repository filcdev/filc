import { AnimatePresence, motion, type Variants } from 'motion/react';
import React, {
  Children,
  type HTMLAttributes,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: {
    step: number;
    currentStep: number;
    onStepClick: (clicked: number) => void;
  }) => ReactNode;
}

// biome-ignore lint/suspicious/noEmptyBlockStatements: this is intentional
const noop = () => {};

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = noop,
  onFinalStepCompleted = noop,
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  renderStepIndicator,
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div
      className="flex min-h-full flex-1 flex-col items-center justify-center p-4 sm:aspect-4/3 md:aspect-2/1"
      {...rest}
    >
      <div
        className={cn(
          'mx-auto w-full max-w-md rounded-4xl border-border bg-card shadow-xl',
          stepCircleContainerClassName
        )}
      >
        <div
          className={`${stepContainerClassName} flex w-full items-center p-8`}
        >
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    currentStep,
                    onStepClick: (clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    },
                    step: stepNumber,
                  })
                ) : (
                  <StepIndicator
                    currentStep={currentStep}
                    disableStepIndicators={disableStepIndicators}
                    onClickStep={(clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }}
                    step={stepNumber}
                  />
                )}
                {isNotLastStep && (
                  <StepConnector isComplete={currentStep > stepNumber} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <StepContentWrapper
          className={`space-y-2 px-8 ${contentClassName}`}
          currentStep={currentStep}
          direction={direction}
          isCompleted={isCompleted}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted && (
          <div className={`px-8 pb-8 ${footerClassName}`}>
            <div
              className={`mt-10 flex ${currentStep !== 1 ? 'justify-between' : 'justify-end'}`}
            >
              {currentStep !== 1 && (
                <Button
                  onClick={handleBack}
                  variant="ghost"
                  {...backButtonProps}
                >
                  {backButtonText}
                </Button>
              )}
              <Button
                onClick={isLastStep ? handleComplete : handleNext}
                variant="default"
                {...nextButtonProps}
              >
                {isLastStep ? 'Complete' : nextButtonText}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type StepContentWrapperProps = {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
};

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className = '',
}: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);

  return (
    <motion.div
      animate={{ height: isCompleted ? 0 : parentHeight }}
      className={className}
      style={{ overflow: 'hidden', position: 'relative' }}
      transition={{ duration: 0.4, type: 'spring' }}
    >
      <AnimatePresence custom={direction} initial={false} mode="sync">
        {!isCompleted && (
          <SlideTransition
            direction={direction}
            key={currentStep}
            onHeightReady={(h) => setParentHeight(h)}
          >
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type SlideTransitionProps = {
  children: ReactNode;
  direction: number;
  onHeightReady: (height: number) => void;
};

function SlideTransition({
  children,
  direction,
  onHeightReady,
}: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      onHeightReady(containerRef.current.offsetHeight);
    }
  }, [onHeightReady]);

  return (
    <motion.div
      animate="center"
      custom={direction}
      exit="exit"
      initial="enter"
      ref={containerRef}
      style={{ left: 0, position: 'absolute', right: 0, top: 0 }}
      transition={{ duration: 0.4 }}
      variants={stepVariants}
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  center: {
    opacity: 1,
    x: '0%',
  },
  enter: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? '-100%' : '100%',
  }),
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? '50%' : '-50%',
  }),
};

type StepProps = {
  children: ReactNode;
};

export function Step({ children }: StepProps) {
  return <div className="px-8">{children}</div>;
}

type StepIndicatorProps = {
  step: number;
  currentStep: number;
  onClickStep: (clicked: number) => void;
  disableStepIndicators?: boolean;
};

function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators = false,
}: StepIndicatorProps) {
  let status: 'active' | 'inactive' | 'complete';
  if (currentStep === step) {
    status = 'active';
  } else if (currentStep < step) {
    status = 'inactive';
  } else {
    status = 'complete';
  }

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) {
      onClickStep(step);
    }
  };

  return (
    <motion.div
      animate={status}
      className="relative cursor-pointer outline-none focus:outline-none"
      initial={false}
      onClick={handleClick}
    >
      <motion.div
        className="flex h-8 w-8 items-center justify-center rounded-full font-semibold"
        transition={{ duration: 0.3 }}
        variants={{
          active: {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            scale: 1,
          },
          complete: {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            scale: 1,
          },
          inactive: {
            backgroundColor: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
            scale: 1,
          },
        }}
      >
        {status === 'complete' && (
          <CheckIcon className="h-4 w-4 text-primary" />
        )}
        {status === 'active' && (
          <div className="h-3 w-3 rounded-full bg-primary" />
        )}
        {status === 'inactive' && <span className="text-sm">{step}</span>}
      </motion.div>
    </motion.div>
  );
}

type StepConnectorProps = {
  isComplete: boolean;
};

function StepConnector({ isComplete }: StepConnectorProps) {
  const lineVariants: Variants = {
    complete: { backgroundColor: 'hsl(var(--primary))', width: '100%' },
    incomplete: { backgroundColor: 'transparent', width: 0 },
  };

  return (
    <div className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded bg-border">
      <motion.div
        animate={isComplete ? 'complete' : 'incomplete'}
        className="absolute top-0 left-0 h-full"
        initial={false}
        transition={{ duration: 0.4 }}
        variants={lineVariants}
      />
    </div>
  );
}

interface CheckIconProps extends React.SVGProps<SVGSVGElement> {}

function CheckIcon(props: CheckIconProps) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <title>Check Icon</title>
      <motion.path
        animate={{ pathLength: 1 }}
        d="M5 13l4 4L19 7"
        initial={{ pathLength: 0 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        transition={{
          delay: 0.1,
          duration: 0.3,
          ease: 'easeOut',
          type: 'tween',
        }}
      />
    </svg>
  );
}
