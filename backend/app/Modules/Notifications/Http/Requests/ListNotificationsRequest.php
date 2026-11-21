<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use App\Modules\Notifications\Data\NotificationFilters;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListNotificationsRequest extends FormRequest
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
            ...$this->paginationRules(['id' => 'uuid']),
            'unread' => ['nullable', 'boolean'],
            'organization' => ['nullable', 'uuid'],
        ];
    }

    public function toData(): NotificationFilters
    {
        return new NotificationFilters(
            $this->boolean('unread'),
            $this->filled('organization') ? strtolower((string) $this->validated('organization')) : null,
        );
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
