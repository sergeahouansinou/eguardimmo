<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum ExclusionReason: string
{
    case NoPayoutAccount = 'no_payout_account';
    case AccountRecentlyChanged = 'account_recently_changed';
    case NegativeBalance = 'negative_balance';
    case ActiveHold = 'active_hold';
    case BelowMinimum = 'below_minimum';
    case BeforePayoutDay = 'before_payout_day';
    case TrustFundsGap = 'trust_funds_gap';
    case Stale = 'stale';
    case InvoicePdfUnavailable = 'invoice_pdf_unavailable';
    case InvoiceNotIssuable = 'invoice_not_issuable';
    case NothingToPay = 'nothing_to_pay';
    case Manual = 'manual';
}
