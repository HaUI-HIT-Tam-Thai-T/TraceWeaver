import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageTitle } from '../constants/pageTitles';

export function usePageTitle() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = getPageTitle(pathname); }, [pathname]);
}
