import * as LucideIcons from 'lucide-react';
import React from 'react';

// This type allows the icons to be used as JSX components
export type IconProps = React.ComponentProps<'svg'> & {
  className?: string;
  size?: string | number;
};

// Use a different approach for the icons
export const Icons = {
  spinner: (props: IconProps) => <LucideIcons.Loader2 {...props} />,
  logout: (props: IconProps) => <LucideIcons.LogOut {...props} />,
  send: (props: IconProps) => <LucideIcons.Send {...props} />,
  user: (props: IconProps) => <LucideIcons.User {...props} />,
  search: (props: IconProps) => <LucideIcons.Search {...props} />,
  settings: (props: IconProps) => <LucideIcons.Settings {...props} />,
  menu: (props: IconProps) => <LucideIcons.Menu {...props} />,
  close: (props: IconProps) => <LucideIcons.X {...props} />,
  chevronLeft: (props: IconProps) => <LucideIcons.ChevronLeft {...props} />,
  chevronRight: (props: IconProps) => <LucideIcons.ChevronRight {...props} />,
  plus: (props: IconProps) => <LucideIcons.Plus {...props} />,
  trash: (props: IconProps) => <LucideIcons.Trash2 {...props} />,
  edit: (props: IconProps) => <LucideIcons.Edit2 {...props} />,
  check: (props: IconProps) => <LucideIcons.Check {...props} />,
  alert: (props: IconProps) => <LucideIcons.AlertCircle {...props} />,
  info: (props: IconProps) => <LucideIcons.Info {...props} />,
  sun: (props: IconProps) => <LucideIcons.Sun {...props} />,
  moon: (props: IconProps) => <LucideIcons.Moon {...props} />,
  refresh: (props: IconProps) => <LucideIcons.RefreshCw {...props} />,
  messageCircle: (props: IconProps) => <LucideIcons.MessageCircle {...props} />,
  chevronUp: (props: IconProps) => <LucideIcons.ChevronUp {...props} />,
  chevronDown: (props: IconProps) => <LucideIcons.ChevronDown {...props} />,
  google: (props: IconProps) => (
    <svg
      aria-hidden="true"
      focusable="false"
      data-prefix="fab"
      data-icon="google"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 488 512"
      {...props}
    >
      <path
        fill="currentColor"
        d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
      ></path>
    </svg>
  ),
}; 