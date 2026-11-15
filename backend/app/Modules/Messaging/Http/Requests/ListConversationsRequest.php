<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\ConversationFilters;
use App\Modules\Messaging\Enums\InboxTab;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListConversationsRequest extends FormRequest
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
            'tab' => ['nullable', Rule::enum(InboxTab::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
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
}
