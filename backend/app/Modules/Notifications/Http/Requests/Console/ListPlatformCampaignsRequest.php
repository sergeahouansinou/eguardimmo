<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests\Console;

use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListPlatformCampaignsRequest extends FormRequest
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
            'status' => ['nullable', Rule::enum(PlatformCampaignStatus::class)],
        ];
    }

    public function status(): ?PlatformCampaignStatus
    {
        return $this->filled('status') ? PlatformCampaignStatus::from((string) $this->string('status')) : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->string('cursor') : null;
    }
}
