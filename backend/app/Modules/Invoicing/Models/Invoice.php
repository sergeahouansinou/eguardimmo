<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Models;

use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Organizations\Enums\VatRegime;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Facture ou avoir (EN 16931, type 381) : une seule table. Les montants d'un avoir sont positifs. Émise, la pièce est
 * immuable (triggers) ; le reste dû se lit dans le grand livre, jamais ici.
 *
 * @property string $id
 * @property string $organization_id
 * @property InvoiceKind $kind
 * @property InvoiceStatus $status
 * @property string|null $number
 * @property string|null $credited_invoice_id
 * @property Carbon|null $issued_on
 * @property Carbon|null $due_on
 * @property Carbon|null $service_from
 * @property Carbon|null $service_to
 * @property string $recipient_party_id
 * @property string|null $lease_id
 * @property string|null $mandate_id
 * @property string|null $fee_statement_id
 * @property string $jurisdiction
 * @property VatRegime $vat_regime
 * @property bool $vat_on_debits
 * @property string $currency
 * @property Money $total_net
 * @property Money $total_tax
 * @property Money $total_gross
 * @property string|null $ledger_entry_id
 * @property string|null $issued_document_id
 * @property string|null $stored_file_id
 * @property string|null $fingerprint
 * @property string|null $template_version
 * @property array<string, mixed>|null $snapshot
 * @property string|null $credit_reason
 * @property string|null $idempotency_key
 * @property string|null $request_hash
 * @property int $lock_version
 * @property Carbon|null $overdue_flagged_at
 * @property Carbon|null $sent_at
 * @property Carbon|null $discarded_at
 * @property string|null $issued_by_user_id
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property-read Collection<int, InvoiceLine> $lines
 * @property-read Collection<int, InvoiceTax> $taxes
 * @property-read Collection<int, InvoicePayment> $payments
 */
final class Invoice extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<InvoiceLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(InvoiceLine::class)->orderBy('position');
    }

    /**
     * @return HasMany<InvoiceTax, $this>
     */
    public function taxes(): HasMany
    {
        return $this->hasMany(InvoiceTax::class)->orderBy('position');
    }

    /**
     * @return HasMany<InvoicePayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class)->orderBy('created_at')->orderBy('id');
    }

    public function isCreditNote(): bool
    {
        return $this->kind === InvoiceKind::CreditNote;
    }

    protected function casts(): array
    {
        return [
            'kind' => InvoiceKind::class,
            'status' => InvoiceStatus::class,
            'issued_on' => 'date:Y-m-d',
            'due_on' => 'date:Y-m-d',
            'service_from' => 'date:Y-m-d',
            'service_to' => 'date:Y-m-d',
            'vat_regime' => VatRegime::class,
            'vat_on_debits' => 'boolean',
            'total_net' => MoneyCast::class.':currency',
            'total_tax' => MoneyCast::class.':currency',
            'total_gross' => MoneyCast::class.':currency',
            'snapshot' => 'array',
            'lock_version' => 'integer',
            'overdue_flagged_at' => 'datetime',
            'sent_at' => 'datetime',
            'discarded_at' => 'datetime',
        ];
    }
}
