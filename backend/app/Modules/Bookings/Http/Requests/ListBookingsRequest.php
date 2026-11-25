<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Http\Requests;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListBookingsRequest extends FormRequest
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
        return [...$this->paginationRules(['id' => 'uuid']), 'status' => ['nullable', Rule::enum(BookingStatus::class)]];
    }

    public function status(): ?BookingStatus
    {
        return $this->filled('status') ? BookingStatus::from((string) $this->validated('status')) : null;
    }

    public function cursorValue(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
