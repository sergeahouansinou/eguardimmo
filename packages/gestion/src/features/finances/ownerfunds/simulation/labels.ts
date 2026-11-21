import { amountHint } from '../../rent/api/rentPayloads';
import type { Currency } from '../../../../format/money';
import type { FeeBase, FeeTaxMode } from './model';

export const BASE_LABEL: Record<FeeBase, string> = { rent: 'Loyer hors charges', rent_and_charges: 'Loyer et charges' };
export const TAX_MODE_LABEL: Record<FeeTaxMode, string> = { excl_tax: 'Hors taxes (TVA en sus)', incl_tax: 'Toutes taxes comprises' };

export const currencyHint = (currency: Currency): string => amountHint(currency);
