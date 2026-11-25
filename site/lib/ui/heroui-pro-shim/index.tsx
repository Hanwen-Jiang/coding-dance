"use client";

import clsx from "clsx";
import React, { createContext, useContext } from "react";

// Zero-private-token open fallback shim for the 3 @heroui-pro/react primitives used in coding-dance:
// Segment, EmptyState, KPIGroup. Matches the exact BEM class names and data-slot attributes of heroui-pro.prebuilt.css.

type SegmentKey = string | number;
type SegmentSize = "sm" | "md" | "lg";
type SegmentVariant = "default" | "ghost";

const SegmentCtx = createContext<{
  selectedKey?: SegmentKey;
  size: SegmentSize;
  variant: SegmentVariant;
  onSelect?: (key: SegmentKey) => void;
}>({ size: "md", variant: "default" });

export interface SegmentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  selectedKey?: SegmentKey;
  defaultSelectedKey?: SegmentKey;
  size?: SegmentSize;
  variant?: SegmentVariant;
  onSelectionChange?: (key: SegmentKey) => void;
}

function SegmentRoot({
  children,
  className,
  selectedKey,
  size = "md",
  variant = "default",
  onSelectionChange,
  ...rest
}: SegmentProps) {
  return (
    <SegmentCtx.Provider value={{ selectedKey, size, variant, onSelect: onSelectionChange }}>
      <div
        role="radiogroup"
        data-slot="segment"
        className={clsx(
          "segment",
          size === "sm" && "segment--sm",
          variant === "ghost" && "segment--ghost",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </SegmentCtx.Provider>
  );
}

export interface SegmentItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "id"> {
  id: SegmentKey;
  isDisabled?: boolean;
}

function SegmentItem({ id, children, className, isDisabled, disabled, ...rest }: SegmentItemProps) {
  const ctx = useContext(SegmentCtx);
  const selected = ctx.selectedKey !== undefined && String(ctx.selectedKey) === String(id);
  const off = !!(isDisabled || disabled);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={off}
      data-slot="segment-item"
      data-selected={selected ? "true" : undefined}
      data-shim-indicator="true"
      data-disabled={off ? "true" : undefined}
      className={clsx(
        "segment__item",
        `segment__item--${ctx.size}`,
        ctx.variant === "ghost" && "segment__item--ghost",
        className,
      )}
      onClick={() => !off && ctx.onSelect?.(id)}
      {...rest}
    >
      <span className="segment__separator" aria-hidden="true" />
      {children}
    </button>
  );
}

export const Segment = Object.assign(SegmentRoot, { Item: SegmentItem });

// —— EmptyState ——

function EmptyStateRoot({
  children,
  className,
  size = "md",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" | "lg" }) {
  return (
    <div data-slot="empty-state" className={clsx("empty-state", `empty-state--${size}`, className)} {...rest}>
      {children}
    </div>
  );
}

function EmptyStateHeader({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="empty-state-header" className={clsx("empty-state__header", className)} {...rest}>
      {children}
    </div>
  );
}

function EmptyStateMedia({
  children,
  className,
  variant = "default",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "icon" }) {
  return (
    <div data-slot="empty-state-media" data-variant={variant} className={clsx("empty-state__media", className)} {...rest}>
      {children}
    </div>
  );
}

function EmptyStateTitle({ children, className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 data-slot="empty-state-title" className={clsx("empty-state__title", className)} {...rest}>
      {children}
    </h3>
  );
}

function EmptyStateDescription({ children, className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p data-slot="empty-state-description" className={clsx("empty-state__description", className)} {...rest}>
      {children}
    </p>
  );
}

function EmptyStateContent({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="empty-state-content" className={clsx("empty-state__content", className)} {...rest}>
      {children}
    </div>
  );
}

export const EmptyState = Object.assign(EmptyStateRoot, {
  Header: EmptyStateHeader,
  Media: EmptyStateMedia,
  Title: EmptyStateTitle,
  Description: EmptyStateDescription,
  Content: EmptyStateContent,
});

// —— KPIGroup ——

function KPIGroupRoot({
  children,
  className,
  orientation = "horizontal",
  ...rest
}: React.HTMLAttributes<HTMLDListElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <dl
      data-slot="kpi-group"
      className={clsx("kpi-group", `kpi-group--${orientation}`, className)}
      {...rest}
    >
      {children}
    </dl>
  );
}

function KPIGroupSeparator({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" data-slot="kpi-group-separator" className={clsx("kpi-group__separator", className)} {...rest} />;
}

export const KPIGroup = Object.assign(KPIGroupRoot, { Separator: KPIGroupSeparator });
