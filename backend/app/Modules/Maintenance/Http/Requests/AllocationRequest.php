<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\AllocationInputData;
use App\Modules\Maintenance\Enums\AllocationTarget;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AllocationRequest extends FormRequest
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
            'target' => ['required', Rule::enum(AllocationTarget::class)],
            'share_amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'wear_basis_points' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'basis_note' => ['nullable', 'string', 'max:300'],
            'idempotency_key' => ['required', 'string', 'min:8', 'max:120', 'regex:/^[A-Za-z0-9._:-]+$/'],
        ];
    }

    public function toData(): AllocationInputData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new AllocationInputData(
            AllocationTarget::from((string) $v['target']),
            (int) $v['share_amount'],
            (int) ($v['wear_basis_points'] ?? 0),
            isset($v['basis_note']) ? trim((string) $v['basis_note']) : null,
            (string) $v['idempotency_key'],
        );
    }
}
