<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListUnpaidRequest extends FormRequest
{
    use PaginatesWithCursor;

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
            'lease' => ['nullable', 'uuid'],
            'after' => ['nullable', 'uuid'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::PAR_PAGE_MAX],
        ];
    }

    public function leaseId(): ?string
    {
        return $this->filled('lease') ? (string) $this->validated('lease') : null;
    }

    public function afterId(): ?string
    {
        return $this->filled('after') ? (string) $this->validated('after') : null;
    }
}
