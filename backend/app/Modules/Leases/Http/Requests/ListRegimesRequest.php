<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ListRegimesRequest extends FormRequest
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
            'unit' => ['required', 'string', 'uuid'],
        ];
    }

    public function unitId(): string
    {
        return (string) $this->validated('unit');
    }
}
