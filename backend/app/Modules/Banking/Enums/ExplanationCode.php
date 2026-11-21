<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum ExplanationCode: string
{
    case AmountEqualsOutstanding = 'amount_equals_outstanding';
    case NoticeNumberInRemittance = 'notice_number_in_remittance';
    case InvoiceNumberInRemittance = 'invoice_number_in_remittance';
    case PayoutNumberInRemittance = 'payout_number_in_remittance';
    case EndToEndKnown = 'end_to_end_known';
    case TenantNameInLabel = 'tenant_name_in_label';
    case KnownCounterparty = 'known_counterparty';
    case DateWithinWindow = 'date_within_window';
    case AmountEqualsEntry = 'amount_equals_entry';
    case OrganizationRule = 'organization_rule';
    case Ambiguous = 'ambiguous';
}
