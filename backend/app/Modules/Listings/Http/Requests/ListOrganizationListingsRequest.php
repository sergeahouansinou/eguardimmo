<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Requests;

use App\Modules\Listings\Enums\ListingStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListOrganizationListingsRequest extends FormRequest
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
        return [...$this->paginationRules(['id' => 'uuid']), 'status' => ['nullable', Rule::enum(ListingStatus::class)]];
    }

    public function status(): ?ListingStatus
    {
        return $this->filled('status') ? ListingStatus::from((string) $this->validated('status')) : null;
    }

    public function cursorValue(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
