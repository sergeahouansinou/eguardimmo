<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use App\Modules\Notifications\Data\CampaignFilters;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListCampaignsRequest extends FormRequest
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
            'status' => ['nullable', Rule::enum(CampaignStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'building' => ['nullable', 'uuid'],
            'period' => ['nullable', Rule::in(['all', 'month', 'quarter', 'year'])],
        ];
    }

    public function toData(): CampaignFilters
    {
        $recherche = trim((string) $this->string('search'));
        $periode = (string) $this->string('period', 'all');

        return new CampaignFilters(
            $this->filled('status') ? CampaignStatus::from((string) $this->string('status')) : null,
            $recherche === '' ? null : $recherche,
            $this->filled('building') ? (string) $this->string('building') : null,
            in_array($periode, ['month', 'quarter', 'year'], true) ? $periode : 'all',
        );
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->string('cursor') : null;
    }
}
