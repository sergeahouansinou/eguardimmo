<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Requests;

use App\Modules\Invoicing\Data\CreditLineData;
use App\Modules\Invoicing\Data\CreditNoteData;
use Illuminate\Foundation\Http\FormRequest;

final class CreditNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Soit `full`, soit des quantités par ligne d'origine ; jamais de montant : le serveur reprend prix et taux de la ligne créditée.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:2', 'max:255'],
            'full' => ['required', 'boolean'],
            'lines' => ['exclude_if:full,true', 'required', 'array', 'min:1', 'max:100'],
            'lines.*.line_id' => ['required', 'uuid', 'distinct'],
            'lines.*.quantity_milli' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'idempotency_key' => ['required', 'string', 'min:8', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
        ];
    }

    public function toData(): CreditNoteData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $complet = (bool) $v['full'];
        /** @var list<array<string, mixed>> $lignes */
        $lignes = $complet ? [] : $v['lines'];

        return new CreditNoteData(
            trim((string) $v['reason']),
            $complet,
            array_map(fn (array $l): CreditLineData => new CreditLineData((string) $l['line_id'], (int) $l['quantity_milli']), $lignes),
            (string) $v['idempotency_key'],
        );
    }
}
