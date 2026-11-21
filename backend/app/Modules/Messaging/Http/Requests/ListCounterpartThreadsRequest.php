<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Data\ThreadFilters;
use App\Shared\Http\ListsForOwner;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

final class ListCounterpartThreadsRequest extends FormRequest
{
    use ListsForOwner;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return $this->ownerRules(['last_message_at' => 'date', 'id' => 'uuid'], [
            'since' => ['nullable', 'date'],
            'unread' => ['nullable', 'boolean'],
            'archived' => ['nullable', 'boolean'],
            'lease_id' => ['nullable', 'uuid'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
    }

    public function toData(): ThreadFilters
    {
        $recherche = trim((string) $this->string('search'));

        return new ThreadFilters(
            $this->perPage(),
            $this->cursor(),
            $this->filled('since') ? CarbonImmutable::parse((string) $this->string('since')) : null,
            $recherche === '' ? null : $recherche,
            null,
            $this->boolean('unread'),
            $this->boolean('archived'),
            $this->filled('lease_id') ? strtolower((string) $this->string('lease_id')) : null,
        );
    }
}
