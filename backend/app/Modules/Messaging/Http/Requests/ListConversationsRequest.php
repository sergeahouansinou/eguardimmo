<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\ConversationFilters;
use App\Modules\Messaging\Data\ThreadFilters;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\InboxTab;
use App\Shared\Http\PaginatesWithCursor;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListConversationsRequest extends FormRequest
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
            ...$this->paginationRules(['last_message_at' => 'date', 'id' => 'uuid']),
            'kind' => ['nullable', Rule::enum(ConversationKind::class)],
            'tab' => ['nullable', Rule::enum(InboxTab::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'since' => ['nullable', 'date'],
            'lease_id' => ['nullable', 'uuid'],
        ];
    }

    public function toData(): ConversationFilters
    {
        $recherche = trim((string) $this->string('search'));

        return new ConversationFilters(
            $this->filled('tab') ? InboxTab::from((string) $this->string('tab')) : InboxTab::All,
            $recherche === '' ? null : $recherche,
            $this->integer('page', 1),
            $this->integer('per_page', 20),
        );
    }

    public function kind(): ConversationKind
    {
        return $this->filled('kind') ? ConversationKind::from((string) $this->string('kind')) : ConversationKind::Internal;
    }

    public function toExternalData(): ThreadFilters
    {
        $recherche = trim((string) $this->string('search'));

        return new ThreadFilters(
            $this->perPage(),
            $this->filled('cursor') ? (string) $this->validated('cursor') : null,
            $this->filled('since') ? CarbonImmutable::parse((string) $this->string('since')) : null,
            $recherche === '' ? null : $recherche,
            $this->filled('tab') ? InboxTab::from((string) $this->string('tab')) : InboxTab::All,
            false,
            false,
            $this->filled('lease_id') ? strtolower((string) $this->string('lease_id')) : null,
        );
    }
}
