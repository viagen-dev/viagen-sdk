import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "~/components/ui/navigation-menu";

export function WebsiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="text-xl font-bold tracking-tight no-underline">
          viagen
        </Link>

        <div className="flex items-center gap-2">
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              {/* ── Learn ── */}
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className="cursor-default bg-transparent text-sm text-muted-foreground data-[state=open]:text-foreground hover:bg-transparent hover:text-foreground focus:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=open]:bg-transparent data-[state=open]:hover:bg-transparent data-[state=open]:focus:bg-transparent active:bg-transparent"
                  onClick={(e) => e.preventDefault()}
                >
                  Learn
                </NavigationMenuTrigger>
                <NavigationMenuContent className="!absolute !w-auto left-1/2 -translate-x-1/2">
                  <ul className="grid w-48 gap-1 p-1">
                    <li>
                      <NavigationMenuLink asChild>
                        <Link to="/company">Company</Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink
                        href="https://viagen.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Dev server plugin
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <Button asChild size="sm">
            <Link to="/login">Try viagen</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
