import { useState } from "react";
import { Link } from "react-router";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Muted } from "~/components/ui/typography";

interface ResourcePickerProps<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  renderItem: (item: T) => React.ReactNode;
  getItemValue: (item: T) => string;
  getItemKey: (item: T) => string;
  selectedKey: string | null;
  onSelect: (item: T) => void;
  onOpen: () => void;
  notConnectedMessage?: string;
  notConnectedLink?: string;
  triggerLabel: string;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}

export function ResourcePicker<T>({
  items,
  loading,
  error,
  renderItem,
  getItemValue,
  getItemKey,
  selectedKey,
  onSelect,
  onOpen,
  notConnectedMessage = "Not connected. Configure in settings.",
  notConnectedLink = "/settings",
  triggerLabel,
  disabled,
  placeholder = "Search...",
  emptyMessage = "No results found.",
}: ResourcePickerProps<T>) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) onOpen();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="gap-1.5"
        >
          {triggerLabel}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        {error === "not_connected" ? (
          <div className="p-4">
            <Muted className="mb-3">{notConnectedMessage}</Muted>
            <Button asChild size="sm" variant="outline">
              <Link to={notConnectedLink}>Go to Settings</Link>
            </Button>
          </div>
        ) : error === "expired" ? (
          <div className="p-4">
            <Muted className="mb-3">
              Token expired. Reconnect in{" "}
              <Link to={notConnectedLink} className="underline">
                settings
              </Link>
              .
            </Muted>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading...
                </div>
              ) : error ? (
                <div className="py-6 text-center text-sm text-destructive">
                  Failed to load. Try again.
                </div>
              ) : (
                <>
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                  <CommandGroup>
                    {items.map((item) => (
                      <CommandItem
                        key={getItemKey(item)}
                        value={getItemValue(item)}
                        onSelect={() => {
                          onSelect(item);
                          setOpen(false);
                        }}
                      >
                        {renderItem(item)}
                        <Check
                          className={cn(
                            "ml-auto size-3.5",
                            selectedKey === getItemKey(item)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
