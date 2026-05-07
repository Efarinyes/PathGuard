import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonGroup } from '../shared/Skeleton';

describe('Skeleton Component', () => {
  it('should render with default props', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toBeTruthy();
    expect(skeleton.className).toContain('animate-pulse');
  });

  it('should render with custom width and height', () => {
    const { container } = render(<Skeleton width={200} height={50} />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.width).toBe('200px');
    expect(skeleton.style.height).toBe('50px');
  });

  it('should render with string width and height', () => {
    const { container } = render(<Skeleton width="50%" height="20px" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.width).toBe('50%');
    expect(skeleton.style.height).toBe('20px');
  });

  it('should render circular variant', () => {
    const { container } = render(<Skeleton variant="circular" width={50} height={50} />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.borderRadius).toBe('50%');
  });

  it('should render text variant with rounded class', () => {
    const { container } = render(<Skeleton variant="text" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('rounded');
  });

  it('should render rectangular variant with rounded-lg class', () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('rounded-lg');
  });

  it('should not animate when animate is false', () => {
    const { container } = render(<Skeleton animate={false} />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).not.toContain('animate-pulse');
  });

  it('should apply custom className', () => {
    const { container } = render(<Skeleton className="custom-class" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('custom-class');
  });

  it('should have aria-hidden attribute', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SkeletonGroup Component', () => {
  it('should render children with proper spacing', () => {
    const { container } = render(
      <SkeletonGroup spacing={20}>
        <Skeleton width={100} height={20} />
        <Skeleton width={200} height={30} />
      </SkeletonGroup>
    );
    const group = container.firstChild as HTMLElement;
    expect(group).toBeTruthy();
    expect(group.style.gap).toBe('20px');
  });

  it('should render with string spacing', () => {
    const { container } = render(
      <SkeletonGroup spacing="1.5rem">
        <Skeleton />
      </SkeletonGroup>
    );
    const group = container.firstChild as HTMLElement;
    expect(group.style.gap).toBe('1.5rem');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <SkeletonGroup className="my-class">
        <Skeleton />
      </SkeletonGroup>
    );
    const group = container.firstChild as HTMLElement;
    expect(group.className).toContain('my-class');
  });

  it('should have flex column layout', () => {
    const { container } = render(
      <SkeletonGroup>
        <Skeleton />
      </SkeletonGroup>
    );
    const group = container.firstChild as HTMLElement;
    expect(group.style.flexDirection).toBe('column');
  });
});