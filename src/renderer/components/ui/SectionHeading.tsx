interface SectionHeadingProps {
  children: React.ReactNode;
  bordered?: boolean;
  action?: React.ReactNode;
}

export function SectionHeading({ children, bordered, action }: SectionHeadingProps) {
  const heading = action ? (
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-medium">{children}</h3>
      {action}
    </div>
  ) : (
    <h3 className="font-medium mb-2">{children}</h3>
  );

  if (bordered) {
    return <div className="border-t pt-4">{heading}</div>;
  }

  return heading;
}
