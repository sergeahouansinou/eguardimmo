<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListMyTicketsRequest extends FormRequest
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
        return $this->paginationRules(['last_activity_at' => 'date', 'id' => 'uuid']);
    }

    public function perPage(): int
    {
        return $this->integer('per_page', self::PAR_PAGE_MAX);
    }
}
