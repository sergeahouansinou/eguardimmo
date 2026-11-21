<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Resources;

use App\Modules\Investments\Http\Support\Shapes;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanFee;
use App\Modules\Investments\Models\LoanInterestAttestation;
use App\Modules\Investments\Support\Currencies;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * La fiche (`$detail`) porte la référence du contrat en clair, les frais et les attestations ; la liste ne montre que ses quatre derniers caractères.
 *
 * @property Loan $resource
 */
final class LoanResource extends JsonResource
{
    public static $wrap = 'data';

    /**
     * @param  list<LoanFee>  $fees
     * @param  list<LoanInterestAttestation>  $attestations
     */
    public function __construct(Loan $pret, private readonly int $outstanding, private readonly CarbonImmutable $asOf, private readonly bool $detail = false, private readonly array $fees = [], private readonly array $attestations = [])
    {
        parent::__construct($pret);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $p = $this->resource;
        $reference = $p->contract_reference;

        return [
            'id' => $p->id,
            'property_id' => $p->property_id,
            'unit_id' => $p->unit_id,
            'lender_label' => $p->lender_label,
            'contract_reference' => $reference === null ? null : ($this->detail ? $reference : '…'.substr($reference, -4)),
            'purpose' => $p->purpose->value,
            'principal' => Shapes::money($p->principal),
            'nominal_rate' => $p->nominal_rate,
            'first_due_on' => $p->first_due_on->toDateString(),
            'term_months' => $p->term_months,
            'deferral_kind' => $p->deferral_kind->value,
            'deferral_months' => $p->deferral_months,
            'insurance_mode' => $p->insurance_mode->value,
            'insurance_rate' => $p->insurance_rate,
            'insurance_amount' => Shapes::moneyOrNull($p->insurance_amount),
            'replaces_loan_id' => $p->replaces_loan_id,
            'schedule_source' => $p->schedule_source->value,
            'status' => $p->status->value,
            'void_reason' => $p->void_reason,
            'repaid_on' => $p->repaid_on?->toDateString(),
            'stored_file_id' => $p->stored_file_id,
            'outstanding' => [
                'as_of' => $this->asOf->toDateString(),
                'amount' => Shapes::money(Currencies::money($this->outstanding, $p->currency)),
                'basis' => 'schedule',
            ],
            'lock_version' => $p->lock_version,
            'created_at' => $p->created_at?->toIso8601String(),
            ...($this->detail ? [
                'fees' => array_map(fn (LoanFee $f): array => ['id' => $f->id, 'kind' => $f->kind, 'paid_on' => $f->paid_on->toDateString(), 'amount' => Shapes::money($f->amount), 'stored_file_id' => $f->stored_file_id], $this->fees),
                'attestations' => array_map(fn (LoanInterestAttestation $a): array => [
                    'id' => $a->id, 'income_year' => $a->income_year, 'interest' => Shapes::money($a->interest), 'insurance' => Shapes::money($a->insurance), 'fees' => Shapes::money($a->fees), 'stored_file_id' => $a->stored_file_id,
                ], $this->attestations),
            ] : []),
        ];
    }
}
