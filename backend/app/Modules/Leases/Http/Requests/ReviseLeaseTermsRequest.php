<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\TermRevisionData;
use App\Modules\Leases\Enums\TermChangeReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class ReviseLeaseTermsRequest extends FormRequest
{
    public const int MAX_CHANGES = 50;

    public const int MAX_AMOUNT = 99_999_999_999;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'lock_version' => ['required', 'integer', 'min:1'],
            'effective_on' => ['required', 'date_format:Y-m-d'],
            'reason' => ['required', Rule::enum(TermChangeReason::class)->except([TermChangeReason::Initial])],
            'changes' => ['required', 'array', 'min:1', 'max:'.self::MAX_CHANGES],
            'changes.*.component_term_id' => ['required', 'uuid', 'distinct'],
            'changes.*.close' => ['sometimes', 'boolean'],
            'changes.*.amount' => ['nullable', 'integer', 'min:0', 'max:'.self::MAX_AMOUNT],
            'changes.*.vat_bp' => ['nullable', 'integer', 'between:0,10000'],
            'changes.*.indexed' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validateur): void {
            /** @var array<int, array<string, mixed>> $changements */
            $changements = (array) $this->input('changes', []);

            foreach ($changements as $i => $changement) {
                $supprime = filter_var($changement['close'] ?? false, FILTER_VALIDATE_BOOLEAN);

                if ($supprime && (($changement['amount'] ?? null) !== null || ($changement['vat_bp'] ?? null) !== null || ($changement['indexed'] ?? null) !== null)) {
                    $validateur->errors()->add("changes.{$i}.close", 'Une composante supprimée ne porte ni montant, ni TVA, ni indexation.');
                }

                if (! $supprime && ($changement['amount'] ?? null) === null) {
                    $validateur->errors()->add("changes.{$i}.amount", 'Le nouveau montant est obligatoire.');
                }
            }
        }];
    }

    public function toData(): TermRevisionData
    {
        /** @var array{lock_version: int|string, effective_on: string, reason: string, changes: list<array<string, mixed>>} $v */
        $v = $this->validated();

        return new TermRevisionData(
            leaseVersion: (int) $v['lock_version'],
            effectiveOn: $v['effective_on'],
            reason: TermChangeReason::from($v['reason']),
            changes: array_map(fn (array $c): array => [
                'component_term_id' => (string) $c['component_term_id'],
                'amount' => isset($c['amount']) ? (int) $c['amount'] : null,
                'vat_bp' => isset($c['vat_bp']) ? (int) $c['vat_bp'] : null,
                'indexed' => isset($c['indexed']) ? (bool) $c['indexed'] : null,
                'close' => (bool) ($c['close'] ?? false),
            ], $v['changes']),
        );
    }
}
