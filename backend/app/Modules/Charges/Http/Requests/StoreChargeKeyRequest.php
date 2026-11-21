<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use App\Modules\Charges\Enums\KeyKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreChargeKeyRequest extends FormRequest
{
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
            'label' => ['required', 'string', 'min:2', 'max:120'],
            'kind' => ['required', Rule::enum(KeyKind::class)],
            'valid_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'shares' => ['nullable', 'array', 'max:500'],
            'shares.*.unit_id' => ['required', 'uuid', 'distinct'],
            'shares.*.weight' => ['required', 'integer', 'min:0', 'max:1000000000'],
        ];
    }

    public function label(): string
    {
        return (string) $this->validated('label');
    }

    public function kind(): KeyKind
    {
        return KeyKind::from((string) $this->validated('kind'));
    }

    public function validFrom(): string
    {
        return (string) $this->validated('valid_from');
    }

    /**
     * @return list<array{unit_id: string, weight: int}>
     */
    public function shares(): array
    {
        $lignes = [];

        foreach ((array) ($this->validated()['shares'] ?? []) as $ligne) {
            $lignes[] = ['unit_id' => (string) $ligne['unit_id'], 'weight' => (int) $ligne['weight']];
        }

        return $lignes;
    }
}
