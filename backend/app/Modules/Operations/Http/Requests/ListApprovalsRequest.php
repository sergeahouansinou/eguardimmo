<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Requests;

use App\Modules\Operations\Enums\ApprovableAction;
use App\Modules\Operations\Enums\ApprovalStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListApprovalsRequest extends FormRequest
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
            'status' => ['nullable', Rule::enum(ApprovalStatus::class)],
            'action' => ['nullable', Rule::enum(ApprovableAction::class)],
            'mine' => ['nullable', 'boolean'],
        ];
    }

    public function status(): ?ApprovalStatus
    {
        return $this->filled('status') ? ApprovalStatus::from((string) $this->string('status')) : null;
    }

    public function action(): ?ApprovableAction
    {
        return $this->filled('action') ? ApprovableAction::from((string) $this->string('action')) : null;
    }

    public function mine(): bool
    {
        return $this->boolean('mine');
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
