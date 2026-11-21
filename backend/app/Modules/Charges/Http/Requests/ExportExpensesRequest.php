<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ExportExpensesRequest extends FormRequest
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
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after:from'],
            'property_id' => ['nullable', 'uuid'],
        ];
    }

    public function from(): string
    {
        return (string) $this->validated('from');
    }

    public function to(): string
    {
        return (string) $this->validated('to');
    }

    public function propertyId(): ?string
    {
        return $this->filled('property_id') ? (string) $this->validated('property_id') : null;
    }
}
