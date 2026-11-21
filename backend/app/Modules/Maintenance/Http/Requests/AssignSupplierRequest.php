<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class AssignSupplierRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'supplier_party_id' => ['required', 'uuid'],
        ];
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }

    public function supplierPartyId(): string
    {
        return (string) $this->validated('supplier_party_id');
    }
}
