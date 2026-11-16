<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class EndOwnershipRequest extends FormRequest
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
        return ['valid_to' => ['required', 'date_format:Y-m-d']];
    }

    public function validTo(): string
    {
        return (string) $this->validated('valid_to');
    }
}
