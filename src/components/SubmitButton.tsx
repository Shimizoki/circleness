type SubmitButtonProps = {
  disabled: boolean;
  onClick: () => void;
};

export function SubmitButton({ disabled, onClick }: SubmitButtonProps) {
  return (
    <button
      type="button"
      className="overlay-btn submit-btn"
      disabled={disabled}
      onClick={onClick}
    >
      Submit
    </button>
  );
}
